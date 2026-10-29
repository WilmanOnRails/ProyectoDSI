import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { calcularTotalesPresupuesto } from '../calculos/calculos.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AgregarItemDto } from './dto/agregar-item.dto.js';
import { CreatePresupuestoDto } from './dto/create-presupuesto.dto.js';
import { UpdatePresupuestoDto } from './dto/update-presupuesto.dto.js';

@Injectable()
export class PresupuestosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPresupuestoDto: CreatePresupuestoDto) {
    const { proyectoId, nombre, pctIndirectos, pctUtilidad, pctImpuestos } =
      createPresupuestoDto;

    const proyecto = await this.prisma.proyecto.findUnique({
      where: { id: proyectoId },
    });
    if (!proyecto) {
      throw new NotFoundException(`Proyecto con ID ${proyectoId} no encontrado`);
    }

    // Si no mandan porcentajes, leemos los defaults de Configuracion (id: 1)
    const config = await this.prisma.configuracion.findUnique({
      where: { id: 1 },
    });

    const pIndirectos =
      pctIndirectos ?? config?.pctIndirectosDef ?? new Prisma.Decimal(15.0);
    const pUtilidad =
      pctUtilidad ?? config?.pctUtilidadDef ?? new Prisma.Decimal(10.0);
    const pImpuestos =
      pctImpuestos ?? config?.pctImpuestosDef ?? new Prisma.Decimal(15.0);

    return this.prisma.presupuesto.create({
      data: {
        proyectoId,
        nombre: nombre ?? `Presupuesto - ${proyecto.nombre}`,
        pctIndirectos: pIndirectos,
        pctUtilidad: pUtilidad,
        pctImpuestos: pImpuestos,
      },
      include: { proyecto: true, items: true },
    });
  }

  findAll() {
    return this.prisma.presupuesto.findMany({
      include: { proyecto: true, items: { include: { actividad: true } } },
      orderBy: { fecha: 'desc' },
    });
  }

  async findOne(id: string) {
    const presupuesto = await this.prisma.presupuesto.findUnique({
      where: { id },
      include: {
        proyecto: true,
        items: {
          include: { actividad: true },
          orderBy: { actividad: { codigo: 'asc' } },
        },
      },
    });

    if (!presupuesto) {
      throw new NotFoundException(`Presupuesto con ID ${id} no encontrado`);
    }

    return presupuesto;
  }

  async update(id: string, updatePresupuestoDto: UpdatePresupuestoDto) {
    await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.presupuesto.update({
        where: { id },
        data: updatePresupuestoDto,
        include: { proyecto: true, items: true },
      });

      return this.recalcularTotalesPresupuesto(tx, id);
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.presupuesto.delete({ where: { id } });
  }

  /**
   * Agrega una actividad al presupuesto.
   * COPIA el costo unitario y por categoría CONGELADOS desde ApuCostoCache.
   * Nunca se recalcula sola.
   */
  async agregarItem(presupuestoId: string, agregarItemDto: AgregarItemDto) {
    const { actividadId, cantidadProyecto } = agregarItemDto;

    await this.findOne(presupuestoId);

    const actividad = await this.prisma.actividad.findUnique({
      where: { id: actividadId },
      include: { apuCostoCache: true },
    });

    if (!actividad) {
      throw new NotFoundException(
        `Actividad con ID ${actividadId} no encontrada`,
      );
    }

    if (!actividad.apuCostoCache) {
      throw new BadRequestException(
        `La actividad '${actividad.nombre}' (${actividad.codigo}) no tiene APU calculado. Debe definir su receta antes de agregarla al presupuesto.`,
      );
    }

    const cache = actividad.apuCostoCache;
    const costoUnitarioCongelado = cache.costoTotal;
    const totalItem = costoUnitarioCongelado.mul(cantidadProyecto);

    return this.prisma.$transaction(async (tx) => {
      await tx.presupuestoItem.upsert({
        where: {
          presupuestoId_actividadId: { presupuestoId, actividadId },
        },
        update: {
          cantidadProyecto,
          costoUnitarioCongelado,
          costoMaterialesCong: cache.costoMateriales,
          costoManoObraCong: cache.costoManoObra,
          costoEquipoCong: cache.costoEquipo,
          costoTransporteCong: cache.costoTransporte,
          total: totalItem,
        },
        create: {
          presupuestoId,
          actividadId,
          cantidadProyecto,
          costoUnitarioCongelado,
          costoMaterialesCong: cache.costoMateriales,
          costoManoObraCong: cache.costoManoObra,
          costoEquipoCong: cache.costoEquipo,
          costoTransporteCong: cache.costoTransporte,
          total: totalItem,
        },
      });

      return this.recalcularTotalesPresupuesto(tx, presupuestoId);
    });
  }

  async quitarItem(presupuestoId: string, itemId: string) {
    await this.findOne(presupuestoId);

    const item = await this.prisma.presupuestoItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.presupuestoId !== presupuestoId) {
      throw new NotFoundException(`Item de presupuesto con ID ${itemId} no encontrado`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.presupuestoItem.delete({ where: { id: itemId } });
      return this.recalcularTotalesPresupuesto(tx, presupuestoId);
    });
  }

  /**
   * Recalcula los costos directos y aplica la fórmula en CASCADA
   * usando la función pura calcularTotalesPresupuesto.
   */
  private async recalcularTotalesPresupuesto(
    tx: Prisma.TransactionClient,
    presupuestoId: string,
  ) {
    const presupuesto = await tx.presupuesto.findUnique({
      where: { id: presupuestoId },
      include: { items: true },
    });

    if (!presupuesto) return null;

    let dirMateriales = new Prisma.Decimal(0);
    let dirManoObra = new Prisma.Decimal(0);
    let dirEquipo = new Prisma.Decimal(0);
    let dirTransporte = new Prisma.Decimal(0);
    let costosDirectos = new Prisma.Decimal(0);

    for (const item of presupuesto.items) {
      const cant = item.cantidadProyecto;
      dirMateriales = dirMateriales.add(item.costoMaterialesCong.mul(cant));
      dirManoObra = dirManoObra.add(item.costoManoObraCong.mul(cant));
      dirEquipo = dirEquipo.add(item.costoEquipoCong.mul(cant));
      dirTransporte = dirTransporte.add(item.costoTransporteCong.mul(cant));
      costosDirectos = costosDirectos.add(item.total);
    }

    const calculo = calcularTotalesPresupuesto(costosDirectos, {
      pctIndirectos: presupuesto.pctIndirectos,
      pctUtilidad: presupuesto.pctUtilidad,
      pctImpuestos: presupuesto.pctImpuestos,
    });

    return tx.presupuesto.update({
      where: { id: presupuestoId },
      data: {
        costosDirectos: calculo.costosDirectos,
        costoMateriales: dirMateriales.toDecimalPlaces(2),
        costoManoObra: dirManoObra.toDecimalPlaces(2),
        costoEquipo: dirEquipo.toDecimalPlaces(2),
        costoTransporte: dirTransporte.toDecimalPlaces(2),
        indirectos: calculo.indirectos,
        utilidad: calculo.utilidad,
        impuestos: calculo.impuestos,
        total: calculo.total,
      },
      include: { proyecto: true, items: { include: { actividad: true } } },
    });
  }
}
