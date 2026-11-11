import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  calcularResumenPresupuesto,
  calcularTotalesLinea,
} from '../calculos/calculos.js';
import { CreateActivityDto } from './dto/create-activity.dto.js';
import { QueryActivityDto } from './dto/query-activity.dto.js';
import { UpdateActivityDto } from './dto/update-activity.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { crearApuAutomaticoEnTransaccion } from '../apus/apu-automatico.js';

@Injectable()
export class ActivitiesService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.prisma.$transaction(async (tx) => {
        const actividadHuerfana = { presupuestoItems: { none: {} } };
        await tx.apuCostoCache.deleteMany({
          where: { actividad: actividadHuerfana },
        });
        await tx.apuDetalle.deleteMany({
          where: { actividad: actividadHuerfana },
        });
        await tx.actividad.deleteMany({ where: actividadHuerfana });
      });
    } catch {
      // Silenciar si la BD no está lista
    }
  }

  create(createActivityDto: CreateActivityDto) {
    const {
      proyectoId,
      presupuestoId,
      cantidadProyecto,
      ...actividadData
    } = createActivityDto;

    return this.prisma.$transaction(
      async (tx) => {
        const [proyecto, presupuesto] = await Promise.all([
          tx.proyecto.findUnique({ where: { id: proyectoId } }),
          tx.presupuesto.findUnique({ where: { id: presupuestoId } }),
        ]);
        if (!proyecto) {
          throw new NotFoundException(
            `Proyecto con ID ${proyectoId} no encontrado`,
          );
        }
        if (!presupuesto) {
          throw new NotFoundException(
            `Presupuesto con ID ${presupuestoId} no encontrado`,
          );
        }
        if (presupuesto.proyectoId !== proyectoId) {
          throw new BadRequestException(
            'El presupuesto seleccionado no pertenece al proyecto indicado.',
          );
        }

        const actividad = await tx.actividad.create({
          data: {
            ...actividadData,
            codigo: `ACT-${randomUUID().slice(0, 8).toUpperCase()}`,
          },
        });
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
        );
        const totales = calcularTotalesLinea({
          cantidadProyecto,
          costoUnitarioCongelado: resultado.cache.costoTotal,
          costoMaterialesCong: resultado.cache.costoMateriales,
          costoManoObraCong: resultado.cache.costoManoObra,
          costoEquipoCong: resultado.cache.costoEquipo,
          costoTransporteCong: resultado.cache.costoTransporte,
          total: resultado.cache.costoTotal,
        });

        await tx.presupuestoItem.create({
          data: {
            presupuestoId,
            actividadId: actividad.id,
            cantidadProyecto,
            costoUnitarioCongelado: resultado.cache.costoTotal,
            costoMaterialesCong: resultado.cache.costoMateriales,
            costoManoObraCong: resultado.cache.costoManoObra,
            costoEquipoCong: resultado.cache.costoEquipo,
            costoTransporteCong: resultado.cache.costoTransporte,
            total: totales.sumaTotal,
          },
        });
        await this.recalcularPresupuesto(tx, presupuestoId);

        return tx.actividad.findUnique({
          where: { id: actividad.id },
          include: {
            presupuestoItems: {
              include: { presupuesto: { include: { proyecto: true } } },
            },
            apuDetalles: { include: { recurso: true } },
            apuCostoCache: true,
          },
        });
      },
      { timeout: 30000, maxWait: 10000 },
    );
  }

  async findAll(query: QueryActivityDto = {}) {
    const where = query.proyectoId
      ? {
          presupuestoItems: {
            some: { presupuesto: { proyectoId: query.proyectoId } },
          },
        }
      : undefined;
    const select = {
      id: true,
      codigo: true,
      nombre: true,
      unidad: true,
      capituloCodigo: true,
      capituloNombre: true,
      presupuestoItems: {
        where: query.proyectoId
          ? { presupuesto: { proyectoId: query.proyectoId } }
          : undefined,
        take: 1,
        select: {
          id: true,
          presupuestoId: true,
          cantidadProyecto: true,
          presupuesto: {
            select: {
              id: true,
              nombre: true,
              proyecto: {
                select: { id: true, nombre: true },
              },
            },
          },
        },
      },
    } as const;
    const orderBy = { codigo: 'asc' } as const;

    if (query.pagina === undefined && query.limite === undefined) {
      return this.prisma.actividad.findMany({ where, select, orderBy });
    }

    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 50;
    const [items, total] = await Promise.all([
      this.prisma.actividad.findMany({
        where,
        select,
        orderBy,
        skip: (pagina - 1) * limite,
        take: limite,
      }),
      this.prisma.actividad.count({ where }),
    ]);

    return { items, total, pagina, limite };
  }

  findOne(id: string) {
    return this.prisma.actividad.findUnique({
      where: { id },
      include: {
        presupuestoItems: {
          include: {
            presupuesto: {
              include: {
                proyecto: true,
              },
            },
          },
        },
      },
    });
  }

  async update(id: string, updateActivityDto: UpdateActivityDto) {
    const {
      presupuestoItemId,
      cantidadProyecto,
      ...actividadData
    } = updateActivityDto;

    return this.prisma.$transaction(
      async (tx) => {
        const actividad = await tx.actividad.update({
          where: { id },
          data: actividadData,
        });

        if (presupuestoItemId && cantidadProyecto !== undefined) {
          const item = await tx.presupuestoItem.findUnique({
            where: { id: presupuestoItemId },
          });
          if (!item || item.actividadId !== id) {
            throw new NotFoundException(
              'La actividad no está asociada a esa partida del presupuesto.',
            );
          }

          await tx.presupuestoItem.update({
            where: { id: presupuestoItemId },
            data: { cantidadProyecto },
          });
          await this.recalcularPresupuesto(tx, item.presupuestoId);
        } else if (
          (presupuestoItemId && cantidadProyecto === undefined) ||
          (!presupuestoItemId && cantidadProyecto !== undefined)
        ) {
          throw new BadRequestException(
            'Para actualizar la cantidad debe enviar la partida del presupuesto y la cantidad.',
          );
        }

        return actividad;
      },
      { timeout: 30000, maxWait: 10000 },
    );
  }

  remove(id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.apuCostoCache.deleteMany({ where: { actividadId: id } });
      await tx.apuDetalle.deleteMany({ where: { actividadId: id } });
      await tx.presupuestoItem.deleteMany({ where: { actividadId: id } });
      return tx.actividad.delete({ where: { id } });
    });
  }

  async removeFromPresupuesto(id: string, itemId: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.presupuestoItem.findUnique({
        where: { id: itemId },
      });
      if (!item || item.actividadId !== id) {
        throw new NotFoundException(
          'La actividad no está asociada a esa partida del presupuesto.',
        );
      }

      await tx.presupuestoItem.delete({ where: { id: itemId } });
      await this.recalcularPresupuesto(tx, item.presupuestoId);

      const usosRestantes = await tx.presupuestoItem.count({
        where: { actividadId: id },
      });
      if (usosRestantes > 0) {
        return { eliminado: true, actividadEliminada: false };
      }

      await tx.apuCostoCache.deleteMany({ where: { actividadId: id } });
      await tx.apuDetalle.deleteMany({ where: { actividadId: id } });
      await tx.actividad.delete({ where: { id } });
      return { eliminado: true, actividadEliminada: true };
    }, { timeout: 30000, maxWait: 10000 });
  }

  private async recalcularPresupuesto(
    tx: Prisma.TransactionClient,
    presupuestoId: string,
  ) {
    const presupuesto = await tx.presupuesto.findUnique({
      where: { id: presupuestoId },
      select: {
        pctIndirectos: true,
        pctAdministracion: true,
        pctUtilidad: true,
        pctImpuestos: true,
        pctImprevistos: true,
      },
    });
    if (!presupuesto) {
      throw new NotFoundException(
        `Presupuesto con ID ${presupuestoId} no encontrado`,
      );
    }

    const items = await tx.presupuestoItem.findMany({
      where: { presupuestoId },
    });
    const resumen = calcularResumenPresupuesto(items, presupuesto);
    await tx.presupuesto.update({
      where: { id: presupuestoId },
      data: resumen,
    });
  }
}
