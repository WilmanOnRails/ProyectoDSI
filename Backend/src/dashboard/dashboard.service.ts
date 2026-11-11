import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerResumen() {
    const [proyectos, presupuestos, actividades] = await Promise.all([
      this.prisma.proyecto.count(),
      this.prisma.presupuesto.count(),
      this.prisma.actividad.count(),
    ]);

    return { proyectos, presupuestos, actividades };
  }
}
