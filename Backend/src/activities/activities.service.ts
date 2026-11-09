import { Injectable, OnModuleInit } from '@nestjs/common';
import { CreateActivityDto } from './dto/create-activity.dto.js';
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
      const huerfanas = await this.prisma.actividad.findMany({
        where: {
          presupuestoItems: {
            none: {},
          },
        },
        select: { id: true },
      });

      for (const act of huerfanas) {
        await this.prisma.apuCostoCache.deleteMany({ where: { actividadId: act.id } });
        await this.prisma.apuDetalle.deleteMany({ where: { actividadId: act.id } });
        await this.prisma.actividad.delete({ where: { id: act.id } });
      }
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

  async findAll() {
    await this.generarApusPendientes();

    return this.prisma.actividad.findMany({
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
      orderBy: { codigo: 'asc' },
    });
  }

  private async generarApusPendientes() {
    await this.prisma.$transaction(
      async (tx) => {
        const pendientes = await tx.actividad.findMany({
          where: { apuDetalles: { none: {} } },
          orderBy: { codigo: 'asc' },
          select: {
            id: true,
            nombre: true,
            unidad: true,
            presupuestoItems: {
              orderBy: { orden: 'asc' },
              take: 1,
              select: { cantidadProyecto: true },
            },
          },
        });
        if (pendientes.length === 0) return;

        const recursos = await tx.recurso.findMany({
          where: { activo: true },
          select: {
            id: true,
            tipo: true,
            descripcion: true,
            costoUnitario: true,
          },
        });
        for (const actividad of pendientes) {
          const resultado = await crearApuAutomaticoEnTransaccion(
            tx,
            actividad,
            recursos,
            actividad.presupuestoItems[0]?.cantidadProyecto ?? 1,
          );
          await sincronizarPresupuestosApu(
            tx,
            actividad.id,
            resultado.cache,
          );
        }
      },
      { timeout: 120000, maxWait: 10000 },
    );
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
