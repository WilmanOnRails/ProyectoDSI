import { Injectable } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  create(createProjectDto: CreateProjectDto) {
    return this.prisma.proyecto.create({ data: createProjectDto });
  }

  findAll() {
    return this.prisma.proyecto.findMany();
  }

  findOne(id: string) {
    return this.prisma.proyecto.findUnique({
      where: { id },
    });
  }

  update(id: string, updateProjectDto: UpdateProjectDto) {
    return this.prisma.proyecto.update({
      where: { id },
      data: updateProjectDto,
    });
  }

  async remove(id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        // 1. Buscar presupuestos del proyecto con sus ítems
        const presupuestos = await tx.presupuesto.findMany({
          where: { proyectoId: id },
          include: { items: { select: { actividadId: true } } },
        });

        const actividadIds = new Set<string>();
        for (const p of presupuestos) {
          for (const item of p.items) {
            actividadIds.add(item.actividadId);
          }
        }

        // 2. Eliminar ítems de presupuesto y presupuestos (con manejo seguro si ya no existen)
        for (const p of presupuestos) {
          await tx.presupuestoItem.deleteMany({
            where: { presupuestoId: p.id },
          });
          try {
            await tx.presupuesto.delete({
              where: { id: p.id },
            });
          } catch (e: any) {
            if (e?.code !== 'P2025') throw e;
          }
        }

        // 3. Eliminar actividades asociadas que ya no tengan otros usos
        for (const actividadId of actividadIds) {
          const countUsos = await tx.presupuestoItem.count({
            where: { actividadId },
          });
          if (countUsos === 0) {
            await tx.apuCostoCache.deleteMany({ where: { actividadId } });
            await tx.apuDetalle.deleteMany({ where: { actividadId } });
            try {
              await tx.actividad.delete({ where: { id: actividadId } });
            } catch (e: any) {
              if (e?.code !== 'P2025') throw e;
            }
          }
        }

        // 4. Eliminar el proyecto
        return tx.proyecto.delete({
          where: { id },
        });
      },
      { maxWait: 10000, timeout: 120000 },
    );
  }
}
