import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerResumen() {
    const [
      proyectos,
      proyectosPorPresupuesto,
      resumenPresupuesto,
      actividades,
      ultimasActualizaciones,
    ] = await Promise.all([
      this.prisma.proyecto.findMany({
        select: { id: true, nombre: true, estado: true },
      }),
      this.prisma.presupuesto.groupBy({
        by: ['proyectoId'],
        _sum: { total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
      this.prisma.presupuesto.aggregate({
        _sum: {
          total: true,
          costoMateriales: true,
          costoManoObra: true,
          costoEquipo: true,
          costoTransporte: true,
        },
        _count: { _all: true },
      }),
      this.prisma.actividad.count(),
      this.prisma.historialPrecio.findMany({
        take: 5,
        orderBy: { fecha: 'desc' },
        select: {
          id: true,
          precio: true,
          fecha: true,
          recurso: {
            select: { codigo: true, descripcion: true, unidad: true },
          },
        },
      }),
    ]);

    const proyectosPorId = new Map(
      proyectos.map((proyecto) => [proyecto.id, proyecto.nombre]),
    );
    const cantidadFinalizados = proyectos.filter((proyecto) =>
      proyecto.estado.toLocaleLowerCase('es').includes('finaliz'),
    ).length;
    const cantidadEnElaboracion = proyectos.filter((proyecto) =>
      proyecto.estado.toLocaleLowerCase('es').includes('elabor'),
    ).length;
    const costo = resumenPresupuesto._sum;

    return {
      proyectos: proyectos.length,
      presupuestos: resumenPresupuesto._count._all,
      actividades,
      enElaboracion: cantidadEnElaboracion,
      finalizados: cantidadFinalizados,
      valorPresupuestado: (costo.total ?? 0).toString(),
      presupuestosPorProyecto: proyectosPorPresupuesto.map((grupo) => ({
        proyectoId: grupo.proyectoId,
        nombre: proyectosPorId.get(grupo.proyectoId) ?? 'Proyecto',
        total: (grupo._sum.total ?? 0).toString(),
      })),
      distribucionCostos: [
        { tipo: 'Materiales', valor: (costo.costoMateriales ?? 0).toString() },
        { tipo: 'Mano de obra', valor: (costo.costoManoObra ?? 0).toString() },
        { tipo: 'Equipo', valor: (costo.costoEquipo ?? 0).toString() },
        { tipo: 'Transporte', valor: (costo.costoTransporte ?? 0).toString() },
      ],
      ultimasActualizaciones: ultimasActualizaciones.map((actualizacion) => ({
        id: actualizacion.id,
        codigo: actualizacion.recurso.codigo,
        descripcion: actualizacion.recurso.descripcion,
        unidad: actualizacion.recurso.unidad,
        precio: actualizacion.precio.toString(),
        fecha: actualizacion.fecha,
      })),
    };
  }
}
