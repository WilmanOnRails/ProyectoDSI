import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import {
  calcularLineaDesdeApu,
  calcularResumenPresupuesto,
  calcularTotalesLinea,
  type PorcentajesPresupuesto,
} from '../calculos/calculos.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AgregarItemDto } from './dto/agregar-item.dto.js';
import { CreatePresupuestoDto } from './dto/create-presupuesto.dto.js';
import { QueryPresupuestoResumenDto } from './dto/query-presupuesto-resumen.dto.js';
import { UpdatePresupuestoDto } from './dto/update-presupuesto.dto.js';
import {
  porcentajesDesdeConfig,
  recalcularTotalesPresupuesto,
  sincronizarPresupuestoDesdeApus,
} from './recalculo-presupuesto.js';

type PresupuestoConItems = Prisma.PresupuestoGetPayload<{
  include: { proyecto: true; items: { include: { actividad: true } } };
}>;

@Injectable()
export class PresupuestosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPresupuestoDto: CreatePresupuestoDto) {
    const {
      proyectoId,
      nombre,
      numero,
      fechaVigencia,
      formaPago,
      tiempoEjecucion,
      exclusiones,
      garantias,
      responsableTecnico,
      observaciones,
      anticipoPct,
    } = createPresupuestoDto;

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

    // Los porcentajes SIEMPRE salen de Configuración.
    const pIndirectos = config?.pctIndirectosDef ?? new Prisma.Decimal(5.0);
    const pAdministracion =
      config?.pctAdministracionDef ?? new Prisma.Decimal(8.0);
    const pUtilidad = config?.pctUtilidadDef ?? new Prisma.Decimal(10.0);
    const pImpuestos = config?.pctImpuestosDef ?? new Prisma.Decimal(15.0);
    const pImprevistos =
      config?.pctImprevistosDef ?? new Prisma.Decimal(0);

    return this.prisma.presupuesto.create({
      data: {
        proyectoId,
        nombre: nombre ?? `Presupuesto - ${proyecto.nombre}`,
        pctIndirectos: pIndirectos,
        pctAdministracion: pAdministracion,
        pctUtilidad: pUtilidad,
        pctImpuestos: pImpuestos,
        pctImprevistos: pImprevistos,
        numero,
        fechaVigencia: fechaVigencia ? new Date(fechaVigencia) : undefined,
        formaPago,
        tiempoEjecucion,
        exclusiones,
        garantias,
        responsableTecnico,
        observaciones,
        anticipoPct: anticipoPct ?? new Prisma.Decimal(0),
      },
      include: { proyecto: true, items: true },
    });
  }

  async findAll() {
    const [presupuestos, config] = await Promise.all([
      this.prisma.presupuesto.findMany({
        include: { proyecto: true, items: { include: { actividad: true } } },
        orderBy: { fecha: 'desc' },
      }),
      this.prisma.configuracion.findUnique({ where: { id: 1 } }),
    ]);

    const porcentajes = porcentajesDesdeConfig(config);
    return presupuestos.map((p) => this.conResumenCalculado(p, porcentajes));
  }

  async findAllResumidos(query: QueryPresupuestoResumenDto = {}) {
    const paginar =
      query.pagina !== undefined || query.limite !== undefined;
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 25;
    const seleccion = {
      select: {
        id: true,
        nombre: true,
        numero: true,
        total: true,
        proyecto: {
          select: { nombre: true },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { fecha: 'desc' },
    } satisfies Prisma.PresupuestoFindManyArgs;

    if (!paginar) {
      const presupuestos = await this.prisma.presupuesto.findMany(seleccion);
      return this.presupuestosResumidos(presupuestos);
    }

    const [presupuestos, total] = await Promise.all([
      this.prisma.presupuesto.findMany({
        ...seleccion,
        skip: (pagina - 1) * limite,
        take: limite,
      }),
      this.prisma.presupuesto.count(),
    ]);

    return {
      items: this.presupuestosResumidos(presupuestos),
      total,
      pagina,
      limite,
    };
  }

  private presupuestosResumidos(
    presupuestos: Array<{
      id: string;
      nombre: string | null;
      numero: string | null;
      total: Prisma.Decimal;
      proyecto: { nombre: string };
      _count: { items: number };
    }>,
  ) {
    return presupuestos.map(({ _count, ...presupuesto }) => ({
      ...presupuesto,
      cantidadActividades: _count.items,
    }));
  }

  async findOne(id: string) {
    const [presupuesto, config] = await Promise.all([
      this.prisma.presupuesto.findUnique({
        where: { id },
        include: {
          proyecto: true,
          items: {
            include: { actividad: true },
            orderBy: { actividad: { codigo: 'asc' } },
          },
        },
      }),
      this.prisma.configuracion.findUnique({ where: { id: 1 } }),
    ]);

    if (!presupuesto) {
      throw new NotFoundException(`Presupuesto con ID ${id} no encontrado`);
    }

    const porcentajes = porcentajesDesdeConfig(config);
    return this.conResumenCalculado(presupuesto, porcentajes);
  }

  /**
   * Calcula el resumen con la MISMA función pura que se usa al guardar.
   * Los porcentajes se toman del módulo de Configuración y las columnas P.U.
   * salen de los costos unitarios congelados del APU.
   */
  private conResumenCalculado(
    presupuesto: PresupuestoConItems,
    porcentajes: PorcentajesPresupuesto,
  ) {
    const items = presupuesto.items.map((item) => {
      const linea = calcularTotalesLinea(item);

      return {
        ...item,
        totalMateriales: linea.totalMateriales,
        totalManoObra: linea.totalManoObra,
        totalEquipo: linea.totalEquipo,
        totalTransporte: linea.totalTransporte,
        sumaTotal: linea.sumaTotal,
        puMateriales: linea.puMateriales,
        puManoObra: linea.puManoObra,
        puEquipo: linea.puEquipo,
        puTransporte: linea.puTransporte,
        puTotal: linea.puTotal,
      };
    });

    const resumen = calcularResumenPresupuesto(presupuesto.items, porcentajes);

    return {
      ...presupuesto,
      items,
      pctIndirectos: porcentajes.pctIndirectos,
      pctAdministracion: porcentajes.pctAdministracion,
      pctUtilidad: porcentajes.pctUtilidad,
      pctImprevistos: porcentajes.pctImprevistos,
      pctImpuestos: porcentajes.pctImpuestos,
      costosDirectos: resumen.costosDirectos,
      costoMateriales: resumen.costoMateriales,
      costoManoObra: resumen.costoManoObra,
      costoEquipo: resumen.costoEquipo,
      costoTransporte: resumen.costoTransporte,
      indirectos: resumen.indirectos,
      administracion: resumen.administracion,
      utilidad: resumen.utilidad,
      imprevistos: resumen.imprevistos,
      subtotalNeto: resumen.subtotalNeto,
      impuestos: resumen.impuestos,
      total: resumen.total,
    };
  }

  async update(id: string, updatePresupuestoDto: UpdatePresupuestoDto) {
    await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.presupuesto.update({
        where: { id },
        data: updatePresupuestoDto,
        include: { proyecto: true, items: true },
      });

      return recalcularTotalesPresupuesto(tx, id);
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
    // Copia el importe congelado del APU. El P.U. se obtiene dividiéndolo
    // entre la cantidad del proyecto cuando se muestra la línea.
    const linea = calcularLineaDesdeApu(cache);

    return this.prisma.$transaction(async (tx) => {
      await tx.presupuestoItem.upsert({
        where: {
          presupuestoId_actividadId: { presupuestoId, actividadId },
        },
        update: {
          cantidadProyecto,
          ...linea,
        },
        create: {
          presupuestoId,
          actividadId,
          cantidadProyecto,
          ...linea,
        },
      });

      return recalcularTotalesPresupuesto(tx, presupuestoId);
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
      return recalcularTotalesPresupuesto(tx, presupuestoId);
    });
  }

  async exportarExcel(id: string) {
    const presupuesto = await this.findOne(id);
    const config = await this.prisma.configuracion.findUnique({
      where: { id: 1 },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Presupuesto');

    sheet.addRow([config?.empresa ?? 'Constructora DSI']);
    sheet.addRow([`RUC: ${config?.ruc ?? 'J0310000000000'}`]);
    sheet.addRow([`Presupuesto: ${presupuesto.nombre ?? ''}`]);
    sheet.addRow([`Proyecto: ${presupuesto.proyecto.nombre}`]);
    sheet.addRow([]);

    const headers = [
      'Código',
      'Capítulo',
      'Descripción',
      'U.M.',
      'Cantidad',
      'P.U. Mat.',
      'P.U. M.O.',
      'P.U. Eq.',
      'P.U. Trans.',
      'P.U. Total',
      'Total Mat.',
      'Total M.O.',
      'Total Eq.',
      'Total Trans.',
      'Suma Total',
    ];
    sheet.addRow(headers);
    sheet.getRow(sheet.rowCount).font = { bold: true };

    const capitulos = new Map<string, typeof presupuesto.items>();
    for (const item of presupuesto.items) {
      const capitulo =
        item.actividad.capituloNombre ||
        item.actividad.capituloCodigo ||
        'GENERAL';
      if (!capitulos.has(capitulo)) capitulos.set(capitulo, []);
      capitulos.get(capitulo)!.push(item);
    }

    for (const [capitulo, items] of capitulos) {
      const capRow = sheet.addRow([`CAPÍTULO: ${capitulo}`]);
      capRow.font = { bold: true };
      sheet.mergeCells(capRow.number, 1, capRow.number, headers.length);

      let capMat = new Prisma.Decimal(0);
      let capMo = new Prisma.Decimal(0);
      let capEq = new Prisma.Decimal(0);
      let capTr = new Prisma.Decimal(0);
      let capTotal = new Prisma.Decimal(0);

      for (const item of items) {
        const cant = Number(item.cantidadProyecto);
        const linea = calcularTotalesLinea(item);

        // Usamos siempre la función pura para garantizar que todas las filas
        // tengan sus P.U. y totales calculados correctamente sin depender del origen.
        const puMat = Number(linea.puMateriales);
        const puMo = Number(linea.puManoObra);
        const puEq = Number(linea.puEquipo);
        const puTr = Number(linea.puTransporte);
        const puTotal = Number(linea.puTotal);

        const totalMat = linea.totalMateriales;
        const totalMo = linea.totalManoObra;
        const totalEq = linea.totalEquipo;
        const totalTr = linea.totalTransporte;
        const sumaTotal = linea.sumaTotal;

        capMat = capMat.add(totalMat);
        capMo = capMo.add(totalMo);
        capEq = capEq.add(totalEq);
        capTr = capTr.add(totalTr);
        capTotal = capTotal.add(sumaTotal);

        sheet.addRow([
          item.actividad.codigo,
          capitulo,
          item.actividad.nombre,
          item.actividad.unidad,
          cant,
          puMat,
          puMo,
          puEq,
          puTr,
          puTotal,
          totalMat.toNumber(),
          totalMo.toNumber(),
          totalEq.toNumber(),
          totalTr.toNumber(),
          sumaTotal.toNumber(),
        ]);
      }

      const subRow = sheet.addRow([
        '',
        '',
        `TOTAL CAPÍTULO — ${capitulo}`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        capMat.toNumber(),
        capMo.toNumber(),
        capEq.toNumber(),
        capTr.toNumber(),
        capTotal.toNumber(),
      ]);
      subRow.font = { bold: true };
    }

    sheet.addRow([]);
    sheet.addRow(['RESUMEN FINANCIERO']);
    sheet.addRow(['Costos Directos', Number(presupuesto.costosDirectos)]);
    sheet.addRow(['Indirectos', Number(presupuesto.indirectos)]);
    sheet.addRow(['Administración', Number(presupuesto.administracion)]);
    sheet.addRow(['Utilidad', Number(presupuesto.utilidad)]);
    sheet.addRow(['Imprevistos', Number(presupuesto.imprevistos)]);
    sheet.addRow(['Subtotal Neto', Number(presupuesto.subtotalNeto)]);
    sheet.addRow(['Impuestos', Number(presupuesto.impuestos)]);
    sheet.addRow(['PRECIO TOTAL', Number(presupuesto.total)]);

    sheet.getColumn(5).numFmt = '#,##0.###';
    for (let c = 6; c <= headers.length; c++) {
      sheet.getColumn(c).numFmt = '#,##0.###';
    }
    sheet.getColumn(2).numFmt = '#,##0.###';

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Refresca las líneas del presupuesto con el costo actual de cada APU.
   * Esto mismo se hace automáticamente al editar un APU o un precio; el
   * endpoint sirve para forzar la sincronización cuando se necesite.
   */
  async sincronizarCostos(presupuestoId: string) {
    await this.findOne(presupuestoId);

    return this.prisma.$transaction((tx) =>
      sincronizarPresupuestoDesdeApus(tx, presupuestoId),
    );
  }
}
