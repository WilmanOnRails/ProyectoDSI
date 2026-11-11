import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  crearApuAutomaticoEnTransaccion,
  recalcularCacheApu,
  sincronizarPresupuestosApu,
} from './apu-automatico.js';
import { calcularApu } from '../calculos/calculos.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateApusDto } from './dto/create-apus.dto.js';
import { UpdateApusDto } from './dto/update-apus.dto.js';

@Injectable()
export class ApusService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createApusDto: CreateApusDto) {
    const { actividadId, recursoId, cantidadPorUnidad } = createApusDto;

    await this.verificarActividadYRecurso(actividadId, recursoId);
    this.validarCantidadMinima(cantidadPorUnidad);

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
    await this.generarApuSiHaceFalta(actividadId);

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

  private async generarApuSiHaceFalta(actividadId: string) {
    await this.prisma.$transaction(
      async (tx) => {
        const actividad = await tx.actividad.findUnique({
          where: { id: actividadId },
          select: {
            id: true,
            nombre: true,
            unidad: true,
            apuDetalles: { select: { id: true }, take: 1 },
            presupuestoItems: {
              orderBy: { orden: 'asc' },
              take: 1,
              select: { cantidadProyecto: true },
            },
          },
        });

        if (!actividad) {
          throw new NotFoundException(
            `Actividad con ID ${actividadId} no encontrada`,
          );
        }
        if (actividad.apuDetalles.length > 0) return;

        const recursos = await tx.recurso.findMany({
          where: { activo: true },
          select: {
            id: true,
            tipo: true,
            descripcion: true,
            costoUnitario: true,
          },
        });
        const resultado = await crearApuAutomaticoEnTransaccion(
          tx,
          actividad,
          recursos,
          actividad.presupuestoItems[0]?.cantidadProyecto ?? 1,
        );
        await sincronizarPresupuestosApu(
          tx,
          actividadId,
          resultado.cache,
        );
      },
      { timeout: 30000, maxWait: 10000 },
    );
  }

  async update(id: string, updateApusDto: UpdateApusDto) {
    const actual = await this.findOne(id);
    const cantidad = updateApusDto.cantidadPorUnidad ?? actual.cantidadPorUnidad;
    this.validarCantidadMinima(
      new Prisma.Decimal(cantidad.toString()).toNumber(),
    );

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

  private validarCantidadMinima(cantidad: number) {
    if (cantidad < 1) {
      throw new BadRequestException(
        'La cantidad por unidad de actividad debe ser como mínimo 1.',
      );
    }
  }

  private async recalcularCache(
    tx: Prisma.TransactionClient,
    actividadId: string,
  ) {
    const cache = await recalcularCacheApu(tx, actividadId);
    await sincronizarPresupuestosApu(tx, actividadId, cache);
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

  }

}
