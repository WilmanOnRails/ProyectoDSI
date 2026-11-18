import { describe, expect, it, vi } from 'vitest';
import { ReportesService } from './reportes.service.js';

function crearServicio() {
  const prisma = {
    configuracion: { findUnique: vi.fn().mockResolvedValue(null) },
    proyecto: { findMany: vi.fn().mockResolvedValue([]) },
    recurso: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const dashboard = {
    obtenerResumen: vi.fn().mockResolvedValue({
      proyectos: 0,
      presupuestos: 0,
      actividades: 0,
      enElaboracion: 0,
      finalizados: 0,
      valorPresupuestado: '0',
      presupuestosPorProyecto: [],
      distribucionCostos: [],
      ultimasActualizaciones: [],
    }),
  };

  return {
    servicio: new ReportesService(prisma as never, dashboard as never),
    prisma,
  };
}

describe('ReportesService', () => {
  it('genera el Excel de resumen aunque no haya datos', async () => {
    const { servicio } = crearServicio();

    const archivo = await servicio.resumen();

    expect(archivo.length).toBeGreaterThan(0);
  });

  it('genera el Excel de catálogo aunque no haya recursos', async () => {
    const { servicio } = crearServicio();

    const archivo = await servicio.catalogo({});

    expect(archivo.length).toBeGreaterThan(0);
  });

  it('filtra el catálogo por tipo y estado', async () => {
    const { servicio, prisma } = crearServicio();

    await servicio.catalogo({ tipo: 'material', activo: 'true' });

    expect(prisma.recurso.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tipo: 'material', activo: true },
      }),
    );
  });
});
