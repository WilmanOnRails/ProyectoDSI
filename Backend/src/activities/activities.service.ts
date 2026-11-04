import { Injectable, OnModuleInit } from '@nestjs/common';
import { CreateActivityDto } from './dto/create-activity.dto.js';
import { UpdateActivityDto } from './dto/update-activity.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
    return this.prisma.actividad.create({ data: createActivityDto });
  }

  findAll() {
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
