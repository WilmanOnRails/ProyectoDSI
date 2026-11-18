import { Injectable } from '@nestjs/common';
import { Prisma, TipoRecurso } from '@prisma/client';
import ExcelJS from 'exceljs';
import { DashboardService } from '../dashboard/dashboard.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueryCatalogoDto } from './dto/query-catalogo.dto.js';
import {
  estilizarEncabezado,
  FORMATO_FECHA,
  FORMATO_MONEDA,
  titulo,
} from './excel.util.js';

const etiquetasTipo: Record<TipoRecurso, string> = {
  [TipoRecurso.material]: 'Materiales',
  [TipoRecurso.mano_obra]: 'Mano de obra',
  [TipoRecurso.equipo]: 'Equipo',
  [TipoRecurso.transporte]: 'Transporte',
};

@Injectable()
export class ReportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboard: DashboardService,
  ) {}

  /**
   * "Dashboard en Excel": los mismos indicadores de la pantalla, más el detalle
   * completo por proyecto (la vista solo muestra el top 5).
   */
  async resumen(): Promise<Buffer> {
    const [resumen, config, proyectos] = await Promise.all([
      this.dashboard.obtenerResumen(),
      this.prisma.configuracion.findUnique({ where: { id: 1 } }),
      this.prisma.proyecto.findMany({
        select: {
          nombre: true,
          estado: true,
          presupuestos: { select: { total: true } },
        },
        orderBy: { nombre: 'asc' },
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ObraControl';
    workbook.created = new Date();

    const hoja = workbook.addWorksheet('Resumen');
    hoja.columns = [
      { width: 34 },
      { width: 22 },
      { width: 16 },
      { width: 18 },
      { width: 16 },
    ];

    titulo(hoja, config?.empresa ?? 'Constructora DSI', 5);
    hoja.addRow([`RUC: ${config?.ruc ?? 'J0310000000000'}`]);
    hoja.addRow([`Generado el: ${new Date().toLocaleString('es-NI')}`]);
    hoja.addRow([]);

    const filaIndicadores = hoja.addRow(['INDICADOR', 'VALOR']);
    estilizarEncabezado(hoja, filaIndicadores.number);

    const indicadores: Array<[string, string | number, boolean]> = [
      ['Proyectos', String(resumen.proyectos), false],
      ['Presupuestos', String(resumen.presupuestos), false],
      ['Actividades', String(resumen.actividades), false],
      ['Proyectos en elaboración', String(resumen.enElaboracion), false],
      ['Proyectos finalizados', String(resumen.finalizados), false],
      ['Valor presupuestado', Number(resumen.valorPresupuestado), true],
    ];
    for (const [nombre, valor, esMoneda] of indicadores) {
      const fila = hoja.addRow([nombre, valor]);
      if (esMoneda) fila.getCell(2).numFmt = FORMATO_MONEDA;
    }

    hoja.addRow([]);
    const filaCostos = hoja.addRow(['DISTRIBUCIÓN DE COSTOS', 'VALOR']);
    estilizarEncabezado(hoja, filaCostos.number);
    for (const item of resumen.distribucionCostos) {
      const fila = hoja.addRow([item.tipo, Number(item.valor)]);
      fila.getCell(2).numFmt = FORMATO_MONEDA;
    }

    hoja.addRow([]);
    const filaCambios = hoja.addRow([
      'ÚLTIMOS CAMBIOS DE PRECIO',
      'Descripción',
      'Unidad',
      'Precio',
      'Fecha',
    ]);
    estilizarEncabezado(hoja, filaCambios.number);
    for (const cambio of resumen.ultimasActualizaciones) {
      const fila = hoja.addRow([
        cambio.codigo,
        cambio.descripcion,
        cambio.unidad,
        Number(cambio.precio),
        new Date(cambio.fecha),
      ]);
      fila.getCell(4).numFmt = FORMATO_MONEDA;
      fila.getCell(5).numFmt = FORMATO_FECHA;
    }

    const detalle = workbook.addWorksheet('Por proyecto');
    detalle.columns = [
      { width: 36 },
      { width: 20 },
      { width: 24 },
      { width: 22 },
    ];
    titulo(detalle, 'PRESUPUESTOS POR PROYECTO', 4);
    const filaProyectos = detalle.addRow([
      'Proyecto',
      'Estado',
      'Cantidad de presupuestos',
      'Total presupuestado',
    ]);
    estilizarEncabezado(detalle, filaProyectos.number);

    let totalGeneral = new Prisma.Decimal(0);
    let cantidadPresupuestos = 0;
    for (const proyecto of proyectos) {
      const total = proyecto.presupuestos.reduce(
        (acumulado, presupuesto) => acumulado.add(presupuesto.total),
        new Prisma.Decimal(0),
      );
      totalGeneral = totalGeneral.add(total);
      cantidadPresupuestos += proyecto.presupuestos.length;

      const fila = detalle.addRow([
        proyecto.nombre,
        proyecto.estado,
        proyecto.presupuestos.length,
        total.toNumber(),
      ]);
      fila.getCell(4).numFmt = FORMATO_MONEDA;
    }

    const filaTotal = detalle.addRow([
      'TOTAL',
      '',
      cantidadPresupuestos,
      totalGeneral.toNumber(),
    ]);
    filaTotal.font = { bold: true };
    filaTotal.getCell(4).numFmt = FORMATO_MONEDA;

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Catálogo de recursos con el precio vigente y el último precio registrado
   * en el historial, para poder comparar de un vistazo cuándo cambió cada uno.
   */
  async catalogo(query: QueryCatalogoDto): Promise<Buffer> {
    const where: Prisma.RecursoWhereInput = {};
    if (query.tipo) where.tipo = query.tipo;
    if (query.activo !== undefined) where.activo = query.activo === 'true';

    const recursos = await this.prisma.recurso.findMany({
      where,
      orderBy: [{ tipo: 'asc' }, { codigo: 'asc' }],
      include: {
        historialPrecios: {
          orderBy: { fecha: 'desc' },
          take: 1,
          select: { fecha: true, precio: true, fuente: true },
        },
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ObraControl';
    workbook.created = new Date();

    const hoja = workbook.addWorksheet('Catálogo de precios');
    hoja.columns = [
      { width: 14 },
      { width: 16 },
      { width: 18 },
      { width: 42 },
      { width: 12 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 22 },
      { width: 12 },
    ];

    titulo(hoja, 'CATÁLOGO DE RECURSOS Y PRECIOS', 10);
    hoja.addRow([`Generado el: ${new Date().toLocaleString('es-NI')}`]);
    hoja.addRow([]);

    const filaEncabezado = hoja.addRow([
      'Código',
      'Tipo',
      'Categoría',
      'Descripción',
      'Unidad',
      'Precio vigente',
      'Último precio',
      'Fecha último cambio',
      'Fuente',
      'Estado',
    ]);
    estilizarEncabezado(hoja, filaEncabezado.number);

    for (const recurso of recursos) {
      const ultimo = recurso.historialPrecios[0];
      const fila = hoja.addRow([
        recurso.codigo,
        etiquetasTipo[recurso.tipo],
        recurso.categoria ?? '',
        recurso.descripcion,
        recurso.unidad,
        recurso.costoUnitario.toNumber(),
        ultimo ? ultimo.precio.toNumber() : null,
        ultimo ? new Date(ultimo.fecha) : null,
        ultimo?.fuente ?? recurso.fuente,
        recurso.activo ? 'Activo' : 'Inactivo',
      ]);
      fila.getCell(6).numFmt = FORMATO_MONEDA;
      fila.getCell(7).numFmt = FORMATO_MONEDA;
      fila.getCell(8).numFmt = FORMATO_FECHA;
    }

    hoja.addRow([]);
    const filaTotal = hoja.addRow(['TOTAL DE RECURSOS', recursos.length]);
    filaTotal.font = { bold: true };

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
