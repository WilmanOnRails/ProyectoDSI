import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse') as (
  buffer: Buffer,
) => Promise<{ numpages: number; text: string }>;

type ActividadExtraida = {
  capituloCodigo: string;
  capituloNombre: string;
  codigoOrigen: string;
  descripcion: string;
  cantidad: Prisma.Decimal;
  unidad: string;
};

type DatosPliego = {
  nombreProyecto: string;
  cliente: string;
  actividades: ActividadExtraida[];
};

@Injectable()
export class ImportacionesService {
  private readonly logger = new Logger(ImportacionesService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    const pliego = this.extraerDatosPliego(texto);
    if (pliego.actividades.length === 0) {
      throw new BadRequestException(
        'No se encontraron actividades en la sección DESGLOSE DE ALCANCES del PDF.',
      );
    }

    // Cada carga es independiente. El identificador evita chocar con el campo
    // único Actividad.codigo, incluso si se importa nuevamente el mismo PDF.
    const identificadorImportacion = randomUUID().slice(0, 8).toUpperCase();

    const resultado = await this.prisma.$transaction(
      async (tx) => {
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
            configuracion?.pctIndirectosDef ?? new Prisma.Decimal(15),
          pctUtilidad:
            configuracion?.pctUtilidadDef ?? new Prisma.Decimal(10),
          pctImpuestos:
            configuracion?.pctImpuestosDef ?? new Prisma.Decimal(15),
        },
      });

      const itemsCreados: Array<{
        actividadId: string;
        codigo: string;
        codigoOrigen: string;
        capitulo: string;
      }> = [];

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
          },
        });

        await tx.presupuestoItem.create({
          data: {
            presupuestoId: presupuesto.id,
            actividadId: actividad.id,
            cantidadProyecto: actividadExtraida.cantidad,
            costoUnitarioCongelado: new Prisma.Decimal(0),
            costoMaterialesCong: new Prisma.Decimal(0),
            costoManoObraCong: new Prisma.Decimal(0),
            costoEquipoCong: new Prisma.Decimal(0),
            costoTransporteCong: new Prisma.Decimal(0),
            total: new Prisma.Decimal(0),
          },
        });

        itemsCreados.push({
          actividadId: actividad.id,
          codigo,
          codigoOrigen: actividadExtraida.codigoOrigen,
          capitulo: `${actividadExtraida.capituloCodigo} ${actividadExtraida.capituloNombre}`,
        });
      }

      return { proyecto, presupuesto, itemsCreados };
      },
      {
        // La extracción del PDF se hace antes. Esta transacción solo inserta
        // registros y necesita más tiempo para crear todas las actividades.
        timeout: 120000,
        maxWait: 10000,
      },
    );

    return {
      mensaje:
        'Pliego importado correctamente. Los APU quedan pendientes de configurar para calcular costos.',
      archivo: nombreArchivo,
      paginasProcesadas: paginas,
      proyecto: resultado.proyecto,
      presupuesto: {
        ...resultado.presupuesto,
        cantidadActividades: resultado.itemsCreados.length,
      },
      actividades: resultado.itemsCreados,
    };
  }

  private extraerDatosPliego(texto: string): DatosPliego {
    const inicio = texto.search(/DESGLOSE\s+DE\s+ALCANCES/i);
    if (inicio === -1) {
      throw new BadRequestException(
        'El PDF no contiene la sección DESGLOSE DE ALCANCES.',
      );
    }

    const desdeAlcances = texto.slice(inicio);
    const finMatriz = desdeAlcances.search(/MATRIZ\s+DE\s+EVALUACI[ÓO]N\s+T[ÉE]CNICA/i);
    const seccion =
      finMatriz === -1 ? desdeAlcances : desdeAlcances.slice(0, finMatriz);

    const nombreProyecto = this.buscarNombreProyecto(seccion);
    const cliente = /ALCALD[IÍ]A\s+MUNICIPAL\s+DE\s+([^\n\r]+)/i.exec(seccion)?.[0]
      ?.replace(/\s+/g, ' ')
      .trim() ?? 'No especificado';

    const lineas = seccion
      .replace(/PLIEGO\s+de\s+Bases\s+y\s+Condiciones\s+P[aá]gina\s+\d+\s+de\s+\d+/gi, '')
      .split(/\r?\n/)
      .map((linea) => linea.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const actividades = this.extraerActividades(lineas);
    return { nombreProyecto, cliente, actividades };
  }

  private buscarNombreProyecto(seccion: string): string {
    const coincidencia = /ALCANCES\s+DEL\s+PROYECTO\s*:\s*([^\n\r]+)/i.exec(
      seccion,
    );
    if (!coincidencia?.[1]) {
      throw new BadRequestException(
        'No se encontró el nombre del proyecto dentro del DESGLOSE DE ALCANCES.',
      );
    }

    return coincidencia[1].replace(/\s+/g, ' ').trim();
  }

  private extraerActividades(lineas: string[]): ActividadExtraida[] {
    const actividades: ActividadExtraida[] = [];
    let capituloCodigo = '';
    let capituloNombre = '';
    let codigoActividad: string | null = null;
    let contenidoActividad: string[] = [];

    const guardarActividad = () => {
      if (!codigoActividad || !capituloCodigo) return;

      const textoActividad = contenidoActividad.join(' ').replace(/\s+/g, ' ').trim();
      const coincidenciaFinal = /(?:^|\s)([\d,.]+)\s+([A-Za-zÁÉÍÓÚáéíóúñÑ0-9²³]+)\s*$/.exec(
        textoActividad,
      );

      if (!coincidenciaFinal) {
        this.logger.warn(
          `No se pudo extraer cantidad y unidad de la actividad ${capituloCodigo}-${codigoActividad}`,
        );
        return;
      }

      const cantidad = this.convertirCantidad(coincidenciaFinal[1]);
      const descripcion = textoActividad
        .slice(0, coincidenciaFinal.index)
        .replace(/\s+/g, ' ')
        .trim();

      if (!descripcion || cantidad.lte(0)) {
        this.logger.warn(
          `La actividad ${capituloCodigo}-${codigoActividad} no tiene descripción o cantidad válida`,
        );
        return;
      }

      actividades.push({
        capituloCodigo,
        capituloNombre,
        codigoOrigen: codigoActividad,
        descripcion,
        cantidad,
        unidad: coincidenciaFinal[2],
      });
    };

    for (const linea of lineas) {
      if (/^(?:ÍTEM|ITEM)\s+DESCRIPCI[ÓO]N\s+CANT\s+U\/M$/i.test(linea)) {
        continue;
      }

      const capitulo = /^(\d{3})\s+(.+)$/.exec(linea);
      if (
        capitulo &&
        ['010', '020', '030', '040', '050', '060', '070', '080'].includes(
          capitulo[1],
        )
      ) {
        guardarActividad();
        codigoActividad = null;
        contenidoActividad = [];
        capituloCodigo = capitulo[1];
        capituloNombre = capitulo[2].trim();
        continue;
      }

      const inicioActividad = /^(\d{3})\s+(.+)$/.exec(linea);
      if (inicioActividad && capituloCodigo) {
        guardarActividad();
        codigoActividad = inicioActividad[1];
        contenidoActividad = [inicioActividad[2]];
        continue;
      }

      const codigoSolo = /^(\d{3})$/.exec(linea);
      if (codigoSolo && capituloCodigo) {
        guardarActividad();
        codigoActividad = codigoSolo[1];
        contenidoActividad = [];
        continue;
      }

      if (codigoActividad) {
        contenidoActividad.push(linea);
      }
    }

    guardarActividad();
    return actividades;
  }

  private convertirCantidad(valor: string): Prisma.Decimal {
    const normalizado = valor.replace(/,/g, '');
    const cantidad = new Prisma.Decimal(normalizado);
    if (!cantidad.isFinite()) {
      throw new BadRequestException(`Cantidad inválida encontrada: ${valor}`);
    }
    return cantidad;
  }
}
