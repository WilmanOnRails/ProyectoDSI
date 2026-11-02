import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { calcularApu, calcularTotalesPresupuesto } from '../calculos/calculos.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateApusDto } from './dto/create-apus.dto.js';
import { UpdateApusDto } from './dto/update-apus.dto.js';

@Injectable()
export class ApusService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createApusDto: CreateApusDto) {
    const { actividadId, recursoId, cantidadPorUnidad } = createApusDto;

    await this.verificarActividadYRecurso(actividadId, recursoId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const detalle = await tx.apuDetalle.create({
          data: { actividadId, recursoId, cantidadPorUnidad },
          include: { recurso: true, actividad: true },
        });

        await this.recalcularCache(tx, actividadId);

        return detalle;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Este recurso ya forma parte del APU de esta actividad',
        );
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.apuDetalle.findMany({
      include: { recurso: true, actividad: true },
      orderBy: { actividad: { codigo: 'asc' } },
    });
  }

  async findOne(id: string) {
    const detalle = await this.prisma.apuDetalle.findUnique({
      where: { id },
      include: { recurso: true, actividad: true },
    });

    if (!detalle) {
      throw new NotFoundException(`Detalle de APU con ID ${id} no encontrado`);
    }

    return detalle;
  }

  /** Obtiene la receta completa de una actividad junto con su costo en caché. */
  async obtenerApuPorActividad(actividadId: string) {
    const actividad = await this.prisma.actividad.findUnique({
      where: { id: actividadId },
      include: {
        apuDetalles: {
          include: { recurso: true },
        },
        apuCostoCache: true,
      },
    });

    if (!actividad) {
      throw new NotFoundException(
        `Actividad con ID ${actividadId} no encontrada`,
      );
    }

    return actividad;
  }

  async update(id: string, updateApusDto: UpdateApusDto) {
    const actual = await this.findOne(id);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const actualizado = await tx.apuDetalle.update({
          where: { id },
          data: updateApusDto,
          include: { recurso: true, actividad: true },
        });

        await this.recalcularCache(tx, actual.actividadId);

        return actualizado;
      });
    } catch (error) {
      throw error instanceof Error ? error : new Error('Error al actualizar APU');
    }
  }

  async remove(id: string) {
    const actual = await this.findOne(id);

    return await this.prisma.$transaction(async (tx) => {
      const eliminado = await tx.apuDetalle.delete({
        where: { id },
      });

      await this.recalcularCache(tx, actual.actividadId);

      return eliminado;
    });
  }

  private async verificarActividadYRecurso(
    actividadId: string,
    recursoId: string,
  ) {
    const [actividad, recurso] = await Promise.all([
      this.prisma.actividad.findUnique({ where: { id: actividadId } }),
      this.prisma.recurso.findUnique({ where: { id: recursoId } }),
    ]);

    if (!actividad) {
      throw new NotFoundException(
        `Actividad con ID ${actividadId} no encontrada`,
      );
    }
    if (!recurso) {
      throw new NotFoundException(`Recurso con ID ${recursoId} no encontrado`);
    }
    if (!recurso.activo) {
      throw new BadRequestException(
        `El recurso ${recurso.codigo} está inactivo y no se puede usar en un APU`,
      );
    }
  }

  private async recalcularCache(
    tx: Prisma.TransactionClient,
    actividadId: string,
  ) {
    const receta = await tx.apuDetalle.findMany({
      where: { actividadId },
      include: { recurso: { select: { tipo: true, costoUnitario: true } } },
    });

    const preciosMap: Record<string, Prisma.Decimal> = {};
    const detallesCalculo = receta.map((det) => {
      preciosMap[det.recursoId] = det.recurso.costoUnitario;
      return {
        recursoId: det.recursoId,
        tipo: det.recurso.tipo,
        cantidadPorUnidad: det.cantidadPorUnidad,
      };
    });

    const costoCalculado = calcularApu(detallesCalculo, preciosMap);

    await tx.apuCostoCache.upsert({
      where: { actividadId },
      update: {
        costoMateriales: costoCalculado.costoMateriales,
        costoManoObra: costoCalculado.costoManoObra,
        costoEquipo: costoCalculado.costoEquipo,
        costoTransporte: costoCalculado.costoTransporte,
        costoTotal: costoCalculado.costoTotal,
        fechaCalculo: new Date(),
      },
      create: {
        actividadId,
        costoMateriales: costoCalculado.costoMateriales,
        costoManoObra: costoCalculado.costoManoObra,
        costoEquipo: costoCalculado.costoEquipo,
        costoTransporte: costoCalculado.costoTransporte,
        costoTotal: costoCalculado.costoTotal,
        fechaCalculo: new Date(),
      },
    });

    // Propagación automática a los ítems de presupuesto que usan esta actividad
    const presupuestoItems = await tx.presupuestoItem.findMany({
      where: { actividadId },
    });

    for (const item of presupuestoItems) {
      const costoUnitarioCongelado = costoCalculado.costoTotal;
      const totalItem = costoUnitarioCongelado.mul(item.cantidadProyecto);

      await tx.presupuestoItem.update({
        where: { id: item.id },
        data: {
          costoUnitarioCongelado,
          costoMaterialesCong: costoCalculado.costoMateriales,
          costoManoObraCong: costoCalculado.costoManoObra,
          costoEquipoCong: costoCalculado.costoEquipo,
          costoTransporteCong: costoCalculado.costoTransporte,
          total: totalItem,
        },
      });

      const presupuesto = await tx.presupuesto.findUnique({
        where: { id: item.presupuestoId },
        include: { items: true },
      });

      if (presupuesto) {
        let dirMat = new Prisma.Decimal(0);
        let dirMo = new Prisma.Decimal(0);
        let dirEq = new Prisma.Decimal(0);
        let dirTr = new Prisma.Decimal(0);
        let dirTot = new Prisma.Decimal(0);

        for (const pi of presupuesto.items) {
          const cant = pi.cantidadProyecto;
          dirMat = dirMat.add(pi.costoMaterialesCong.mul(cant));
          dirMo = dirMo.add(pi.costoManoObraCong.mul(cant));
          dirEq = dirEq.add(pi.costoEquipoCong.mul(cant));
          dirTr = dirTr.add(pi.costoTransporteCong.mul(cant));
          dirTot = dirTot.add(pi.total);
        }

        const calc = calcularTotalesPresupuesto(dirTot, {
          pctIndirectos: presupuesto.pctIndirectos,
          pctUtilidad: presupuesto.pctUtilidad,
          pctImpuestos: presupuesto.pctImpuestos,
          pctImprevistos: presupuesto.pctImprevistos,
        });

        await tx.presupuesto.update({
          where: { id: presupuesto.id },
          data: {
            costosDirectos: calc.costosDirectos,
            costoMateriales: dirMat.toDecimalPlaces(2),
            costoManoObra: dirMo.toDecimalPlaces(2),
            costoEquipo: dirEq.toDecimalPlaces(2),
            costoTransporte: dirTr.toDecimalPlaces(2),
            indirectos: calc.indirectos,
            utilidad: calc.utilidad,
            imprevistos: calc.imprevistos,
            subtotalNeto: calc.subtotalNeto,
            impuestos: calc.impuestos,
            total: calc.total,
          },
        });
      }
    }
  }
}
