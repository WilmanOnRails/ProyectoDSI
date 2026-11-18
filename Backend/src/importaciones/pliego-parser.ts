import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type ActividadExtraida = {
  capituloCodigo: string;
  capituloNombre: string;
  codigoOrigen: string;
  descripcion: string;
  cantidad: Prisma.Decimal;
  unidad: string;
};

export type DatosPliego = {
  nombreProyecto: string;
  cliente: string;
  actividades: ActividadExtraida[];
  filasOmitidas?: number;
};

/**
 * Unidades aceptadas. La clave es lo que sale del PDF (incluye errores de OCR)
 * y el valor es cómo lo guardamos nosotros. Agregar acá un nuevo texto no
 * obliga a cambiar el parser.
 */
const UNIDADES: Record<string, string> = {
  m: 'm',
  m2: 'm2',
  m3: 'm3',
  mi: 'mi',
  ml: 'ml',
  kg: 'kg',
  kgs: 'kg',
  kas: 'kg',
  b: 'global',
  gb: 'global',
  gi: 'global',
  gl: 'global',
  glb: 'global',
  gbl: 'global',
  gib: 'global',
  _gb: 'global',
  global: 'global',
  u: 'u',
  un: 'u',
  und: 'u',
  cu: 'u',
  'c/u': 'u',
  clu: 'u',
  lu: 'u',
  pza: 'u',
  pieza: 'u',
  bl: 'bl',
  sdr: 'sdr',
  dia: 'días',
  dias: 'días',
  'día': 'días',
  'días': 'días',
};

const INICIO_SECCION =
  /DESGLOSE\s+DE\s+(?:ALCANCES|PRESUPUESTO)|Tabla:\s*ALCANC/i;
const FIN_SECCION = /MATRIZ\s+DE\s+EVALUACI[ÓO]N\s+T[ÉE]CNICA/i;

function normalizarCantidad(valor: string): Prisma.Decimal {
  // En estos pliegos la coma es separador de miles: 1,300.00 -> 1300.00
  const cantidad = new Prisma.Decimal(valor.replace(/,/g, ''));
  if (!cantidad.isFinite()) {
    throw new BadRequestException(`Cantidad inválida encontrada: ${valor}`);
  }
  return cantidad;
}

function limpiarDescripcion(tokens: string[]): string {
  return tokens
    .join(' ')
    .replace(/[_|]/g, ' ')
    .replace(/^(?:[A-Z]\s+)+/, '')
    .replace(/\s+(?:[A-Z])$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function esEncabezadoCapitulo(codigoCrudo: string, descripcion: string): boolean {
  if (codigoCrudo.includes('_|')) return false;

  const codigo = codigoCrudo.replace(/[_|]/g, '').trim();
  const pareceCodigo =
    (/^\d{3}$/.test(codigo) && Number(codigo) % 10 === 0) ||
    /^[A-Z]$/.test(codigo);
  if (!pareceCodigo || !descripcion) return false;

  return descripcion.split(/\s+/).filter(Boolean).length <= 6;
}

type ParUnidadCantidad = {
  /** Índice donde termina la descripción (no incluye unidad ni cantidad). */
  finDescripcion: number;
  unidad: string;
  cantidad: Prisma.Decimal;
};

/**
 * Busca desde el final el par "unidad + cantidad" O "cantidad + unidad".
 * Ejemplos reales:
 *   formato 2:  "Limpieza inicial m2 1,300.00"
 *   PLIEGO_1:   "Limpieza inicial. 3,710.36 m2"
 *   multilínea: "002 / Corte, tala... / 3.00 und"
 * Al recorrer desde el final evitamos números dentro de la descripción
 * ("I=51cm Norma 1554 kgs 308.73").
 */
function buscarUnidadYCantidad(fila: string[]): ParUnidadCantidad | null {
  const esCantidad = (token: string | undefined): boolean =>
    token !== undefined && /^\d[\d.,]*$/.test(token);

  for (let i = fila.length - 1; i >= 1; i -= 1) {
    const unidad = UNIDADES[fila[i].toLowerCase()];
    if (!unidad) continue;

    // Cantidad a la derecha: "m2 1,300.00"
    if (esCantidad(fila[i + 1])) {
      try {
        return {
          finDescripcion: i,
          unidad,
          cantidad: normalizarCantidad(fila[i + 1]),
        };
      } catch {
        // No era válida; seguimos buscando.
      }
    }

    // Cantidad a la izquierda: "3,710.36 m2"
    if (esCantidad(fila[i - 1])) {
      try {
        return {
          finDescripcion: i - 1,
          unidad,
          cantidad: normalizarCantidad(fila[i - 1]),
        };
      } catch {
        // No era válida; seguimos buscando.
      }
    }
  }
  return null;
}

type LineaPreparada = {
  tokens: string[];
  empiezaConCodigo: boolean;
  esMarcaCapitulo: boolean;
};

/**
 * Funciona tanto si el PDF trae "001 Descripción m2 10.00" en una línea como
 * si trae una palabra por línea: siempre miramos qué token abre la línea.
 */
function prepararLineas(seccion: string): LineaPreparada[] {
  const crudas = seccion
    .split(/\r?\n/)
    .map((linea) => linea.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const lineas: LineaPreparada[] = [];
  let enCabecera = false;

  for (let i = 0; i < crudas.length; i += 1) {
    const linea = crudas[i];

    // Solo la línea suelta "ALCALDÍA" abre la cabecera repetida de página.
    // "ALCALDÍA MUNICIPAL DE X" es el cliente y NO se descarta.
    if (/^ALCALD[IÍ]A$/i.test(linea)) {
      enCabecera = true;
      continue;
    }
    if (enCabecera) {
      if (/P[ÚU]BLICA/i.test(linea)) enCabecera = false;
      continue;
    }

    // Ruido suelto, menos "|": sirve para detectar "B | MOVIMIENTO DE TIERRA".
    if (/^[^\p{L}\p{N}]+$/u.test(linea) && linea !== '|') continue;

    const tokens = linea.split(/\s+/);
    const primero = tokens[0];
    lineas.push({
      tokens,
      empiezaConCodigo: /^\d{3}_?\|?$/.test(primero),
      esMarcaCapitulo: /^[A-Z]$/.test(primero) && crudas[i + 1] === '|',
    });
  }

  return lineas;
}

function armarFilas(lineas: LineaPreparada[]): string[][] {
  const filas: string[][] = [];
  let filaActual: string[] = [];

  for (const linea of lineas) {
    if ((linea.empiezaConCodigo || linea.esMarcaCapitulo) && filaActual.length) {
      filas.push(filaActual);
      filaActual = [];
    }
    filaActual.push(...linea.tokens);
  }

  if (filaActual.length) filas.push(filaActual);
  return filas;
}

/**
 * Extrae actividades, unidades y cantidades SIN depender del título del PDF.
 * El título solo se usa para recortar la sección y sacar nombre/cliente; si no
 * aparece, se intenta de todas formas con todo el texto.
 */
export function extraerDatosPliegoGenerico(
  texto: string,
  nombreArchivo: string,
  nombrePresupuesto?: string,
): DatosPliego {
  const inicio = texto.search(INICIO_SECCION);
  const desdeDesglose = inicio === -1 ? texto : texto.slice(inicio);
  const fin = desdeDesglose.search(FIN_SECCION);
  const seccion = fin === -1 ? desdeDesglose : desdeDesglose.slice(0, fin);

  const cliente =
    /ALCALD[IÍ]A(?:\s+MUNICIPAL)?\s+DE\s+[^\n\r]+/i.exec(texto)?.[0]
      ?.replace(/\s+/g, ' ')
      .trim() ?? 'No especificado';

  const nombreDelTexto =
    /ALCANCES\s+DEL\s+PROYECTO\s*:\s*([^\n\r]+)/i.exec(texto)?.[1]
      ?.replace(/\s+/g, ' ')
      .trim();

  const actividades: ActividadExtraida[] = [];
  let capituloCodigo = '';
  let capituloNombre = '';
  let filasOmitidas = 0;

  for (const fila of armarFilas(prepararLineas(seccion))) {
    const codigoCrudo = fila[0] ?? '';
    const par = buscarUnidadYCantidad(fila);
    const descripcion = limpiarDescripcion(
      fila.slice(1, par ? par.finDescripcion : fila.length),
    );

    if (!par) {
      if (esEncabezadoCapitulo(codigoCrudo, descripcion)) {
        capituloCodigo = codigoCrudo.replace(/[_|]/g, '').trim();
        capituloNombre = descripcion;
      }
      continue;
    }

    if (esEncabezadoCapitulo(codigoCrudo, descripcion) && par.cantidad.equals(1)) {
      capituloCodigo = codigoCrudo.replace(/[_|]/g, '').trim();
      capituloNombre = descripcion;
      continue;
    }

    if (!descripcion || par.cantidad.lte(0)) {
      filasOmitidas += 1;
      continue;
    }

    actividades.push({
      capituloCodigo,
      capituloNombre,
      codigoOrigen: codigoCrudo.replace(/[_|]/g, '').trim(),
      descripcion,
      cantidad: par.cantidad,
      unidad: par.unidad,
    });
  }

  if (actividades.length === 0) {
    throw new BadRequestException(
      'No se encontraron filas con código, descripción, unidad y cantidad. Si el PDF es escaneado, se necesita OCR.',
    );
  }

  return {
    nombreProyecto:
      nombrePresupuesto?.trim() ||
      nombreDelTexto ||
      `Pliego importado - ${nombreArchivo}`,
    cliente,
    actividades,
    filasOmitidas,
  };
}
