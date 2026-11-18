import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import {
  calcularLineaDesdeApu,
  calcularResumenPresupuesto,
  type ItemPresupuestoCalculo,
} from '../calculos/calculos.js';
import {
  cargarRecetasDesdeBd,
  crearApuAutomaticoEnTransaccion,
} from '../apus/apu-automatico.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { extraerDatosPliegoGenerico } from './pliego-parser.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse') as (
  buffer: Buffer,
) => Promise<{ numpages: number; text: string }>;

@Injectable()
export class ImportacionesService {
  constructor(private readonly prisma: PrismaService) { }

  async importarPliegoPdf(
    contenido: Buffer,
    nombreArchivo: string,
    nombrePresupuesto?: string,
  ) {
    let texto: string;
    let paginas: number;

    try {
      const resultado = await pdfParse(contenido);
      texto = resultado.text;
      paginas = resultado.numpages;
    } catch {
      throw new BadRequestException(
        'No fue posible leer el PDF. Verifique que el archivo no esté dañado ni protegido.',
      );
    }

    // Un escaneo casi no trae texto: mejor avisar antes de intentar extraer.
    if (texto.replace(/\s/g, '').length < paginas * 50) {
      throw new BadRequestException(
        'El PDF parece un escaneo y no trae texto legible.',
      );
    }

    const pliego = extraerDatosPliegoGenerico(
      texto,
      nombreArchivo,
      nombrePresupuesto,
    );

    // Cada carga es independiente. El identificador evita chocar con el campo
    // único Actividad.codigo, incluso si se importa nuevamente el mismo PDF.
    const identificadorImportacion = randomUUID().slice(0, 8).toUpperCase();

    const resultado = await this.prisma.$transaction(
      async (tx) => {
        const recursos = await tx.recurso.findMany({
          where: { activo: true },
          select: {
            id: true,
            tipo: true,
            descripcion: true,
            costoUnitario: true,
          },
        });
        // Las recetas del catálogo se leen UNA vez para todo el pliego: cada
        // actividad nueva reutiliza la receta más parecida que ya está en la BD.
        const recetasBd = await cargarRecetasDesdeBd(tx);
        const proyecto = await tx.proyecto.create({
          data: {
            nombre: pliego.nombreProyecto,
            cliente: pliego.cliente,
            estado: 'En elaboración',
            codigo: `PDF-${identificadorImportacion}`,
          },
        });

        const configuracion = await tx.configuracion.findUnique({
          where: { id: 1 },
        });

        const presupuesto = await tx.presupuesto.create({
          data: {
            proyectoId: proyecto.id,
            nombre:
              nombrePresupuesto?.trim() ||
              `Presupuesto importado - ${nombreArchivo}`,
            pctIndirectos:
              configuracion?.pctIndirectosDef ?? new Prisma.Decimal(5),
            pctAdministracion:
              configuracion?.pctAdministracionDef ?? new Prisma.Decimal(8),
            pctUtilidad:
              configuracion?.pctUtilidadDef ?? new Prisma.Decimal(10),
            pctImpuestos:
              configuracion?.pctImpuestosDef ?? new Prisma.Decimal(15),
            pctImprevistos:
              configuracion?.pctImprevistosDef ?? new Prisma.Decimal(0),
          },
        });

        const itemsCreados: Array<{
          actividadId: string;
          codigo: string;
          codigoOrigen: string;
          capitulo: string;
          metodoApu: 'referencia' | 'aproximado';
          referenciaApu: string;
        }> = [];
        const itemsParaResumen: ItemPresupuestoCalculo[] = [];

        for (const [indice, actividadExtraida] of pliego.actividades.entries()) {
          const codigo = [
            'PDF',
            identificadorImportacion,
            actividadExtraida.capituloCodigo,
            actividadExtraida.codigoOrigen,
            String(indice + 1).padStart(2, '0'),
          ].join('-');

          const actividad = await tx.actividad.create({
            data: {
              codigo,
              nombre: actividadExtraida.descripcion,
              unidad: actividadExtraida.unidad,
              capituloCodigo: actividadExtraida.capituloCodigo,
              capituloNombre: actividadExtraida.capituloNombre,
              orden: indice + 1,
            },
          });

          const cantidadProyecto = actividadExtraida.cantidad;
          const apu = await crearApuAutomaticoEnTransaccion(
            tx,
            actividad,
            recursos,
            cantidadProyecto,
            recetasBd,
          );
          // Copia el importe congelado del APU a la línea del presupuesto.
          const linea = calcularLineaDesdeApu(apu.cache);

          await tx.presupuestoItem.create({
            data: {
              presupuestoId: presupuesto.id,
              actividadId: actividad.id,
              cantidadProyecto,
              ...linea,
              costoSubcontratoCong: new Prisma.Decimal(0),
              orden: indice + 1,
            },
          });

          itemsParaResumen.push({
            cantidadProyecto,
            ...linea,
          });
          itemsCreados.push({
            actividadId: actividad.id,
            codigo,
            codigoOrigen: actividadExtraida.codigoOrigen,
            capitulo: `${actividadExtraida.capituloCodigo} ${actividadExtraida.capituloNombre}`,
            metodoApu: apu.metodo,
            referenciaApu: apu.referencia,
          });
        }

        const resumen = calcularResumenPresupuesto(itemsParaResumen, {
          pctIndirectos: presupuesto.pctIndirectos,
          pctAdministracion: presupuesto.pctAdministracion,
          pctUtilidad: presupuesto.pctUtilidad,
          pctImpuestos: presupuesto.pctImpuestos,
          pctImprevistos: presupuesto.pctImprevistos,
        });
        const presupuestoActualizado = await tx.presupuesto.update({
          where: { id: presupuesto.id },
          data: resumen,
        });

        return {
          proyecto,
          presupuesto: presupuestoActualizado,
          itemsCreados,
        };
      },
      {
        // La extracción del PDF queda fuera; esta transacción también crea
        // los APUs iniciales y congela sus costos en las líneas importadas.
        timeout: 120000,
        maxWait: 10000,
      },
    );

    return {
      mensaje:
        'Pliego importado correctamente. Se generaron APUs de referencia o aproximados, editables antes de aprobar el presupuesto.',
      archivo: nombreArchivo,
      paginasProcesadas: paginas,
      filasOmitidas: pliego.filasOmitidas ?? 0,
      proyecto: resultado.proyecto,
      presupuesto: {
        ...resultado.presupuesto,
        cantidadActividades: resultado.itemsCreados.length,
      },
      actividades: resultado.itemsCreados,
    };
  }

}
