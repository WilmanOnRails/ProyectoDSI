import { Injectable, OnModuleInit } from '@nestjs/common';
import { CreateActivityDto } from './dto/create-activity.dto.js';
import { QueryActivityDto } from './dto/query-activity.dto.js';
import { UpdateActivityDto } from './dto/update-activity.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  crearApuAutomaticoEnTransaccion,
  sincronizarPresupuestosApu,
} from '../apus/apu-automatico.js';

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
    return this.prisma.$transaction(
      async (tx) => {
        const actividad = await tx.actividad.create({
          data: createActivityDto,
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
        await sincronizarPresupuestosApu(
          tx,
          actividad.id,
          resultado.cache,
        );
        return actividad;
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
          presupuesto: {
            select: {
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

  update(id: string, updateActivityDto: UpdateActivityDto) {
    return this.prisma.actividad.update({
      where: { id },
      data: updateActivityDto,
    });
  }

  remove(id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.apuCostoCache.deleteMany({ where: { actividadId: id } });
      await tx.apuDetalle.deleteMany({ where: { actividadId: id } });
      await tx.presupuestoItem.deleteMany({ where: { actividadId: id } });
      return tx.actividad.delete({ where: { id } });
    });
  }
}
