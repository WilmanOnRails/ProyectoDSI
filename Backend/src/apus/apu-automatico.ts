import { InternalServerErrorException } from '@nestjs/common';
import { Prisma, TipoRecurso } from '@prisma/client';
import { calcularApu } from '../calculos/calculos.js';

export interface RecursoApuAutomatico {
  id: string;
  tipo: TipoRecurso;
  descripcion: string;
  costoUnitario: Prisma.Decimal;
}

export interface DetalleApuAutomatico {
  recursoId: string;
  tipo: TipoRecurso;
  cantidadPorUnidad: Prisma.Decimal;
}

export interface ResultadoApuAutomatico {
  metodo: 'referencia' | 'aproximado';
  referencia: string;
  detalles: DetalleApuAutomatico[];
}

/**
 * Receta leída de la base de datos: los `apu_detalle` de una actividad que ya
 * existe en el catálogo. Es la única fuente de rendimientos del sistema; en el
 * código no se guardan cantidades ni nombres de recursos.
 */
export interface RecetaBd {
  actividadId: string;
  nombre: string;
  unidad: string;
  detalles: Array<{
    recursoId: string;
    cantidadPorUnidad: Prisma.Decimal;
  }>;
}

/** Orden fijo de los grupos de la memoria de costos (solo ordena la salida). */
const ORDEN_TIPOS: TipoRecurso[] = [
  TipoRecurso.material,
  TipoRecurso.mano_obra,
  TipoRecurso.equipo,
  TipoRecurso.transporte,
];

/**
 * Similitud mínima entre nombres para reutilizar la receta de otra actividad.
 * Con 0.7 se evita el error típico de tomar la receta de una actividad que solo
 * comparte parte del nombre: dos nombres que difieren en una palabra dan 0.5 y
 * pueden significar trabajos distintos. En ese caso se prefiere una receta
 * aproximada antes que una equivocada.
 */
const UMBRAL_COINCIDENCIA = 0.7;

/** Quita tildes, signos y mayúsculas para poder comparar descripciones. */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palabras significativas (descarta artículos y preposiciones de 1-2 letras). */
function palabras(texto: string): Set<string> {
  return new Set(
    normalizarTexto(texto)
      .split(' ')
      .filter((palabra) => palabra.length > 2),
  );
}

/** Coeficiente de Dice: 1 = nombres idénticos, 0 = sin palabras en común. */
function similitud(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let comunes = 0;
  for (const palabra of a) {
    if (b.has(palabra)) comunes += 1;
  }

  return (2 * comunes) / (a.size + b.size);
}

/**
 * Carga en UNA sola consulta todas las recetas del catálogo agrupadas por
 * actividad. Se puede llamar una vez por transacción y reutilizar el resultado
 * en todas las actividades (evita N consultas al importar un PDF completo).
 */
export async function cargarRecetasDesdeBd(
  tx: Prisma.TransactionClient,
  excluirActividadId?: string,
): Promise<RecetaBd[]> {
  const filas = await tx.apuDetalle.findMany({
    where: excluirActividadId
      ? { actividadId: { not: excluirActividadId } }
      : undefined,
    select: {
      actividadId: true,
      recursoId: true,
      cantidadPorUnidad: true,
      actividad: { select: { nombre: true, unidad: true } },
    },
    orderBy: { actividadId: 'asc' },
  });

  const recetas = new Map<string, RecetaBd>();

  for (const fila of filas) {
    let receta = recetas.get(fila.actividadId);
    if (!receta) {
      receta = {
        actividadId: fila.actividadId,
        nombre: fila.actividad.nombre,
        unidad: fila.actividad.unidad,
        detalles: [],
      };
      recetas.set(fila.actividadId, receta);
    }

    receta.detalles.push({
      recursoId: fila.recursoId,
      cantidadPorUnidad: fila.cantidadPorUnidad,
    });
  }

  return [...recetas.values()];
}

/**
 * Busca en las recetas de la BD la que más se parece al nombre de la actividad.
 * No filtra por umbral; solo devuelve la mejor candidata (o null si no hay).
 */
export function elegirRecetaSimilar(
  actividad: { nombre: string; unidad: string },
  recetas: RecetaBd[],
): { receta: RecetaBd; puntaje: number } | null {
  const palabrasActividad = palabras(actividad.nombre);
  const unidadActividad = normalizarTexto(actividad.unidad);

  let mejor: { receta: RecetaBd; puntaje: number } | null = null;

  for (const receta of recetas) {
    if (receta.detalles.length === 0) continue;

    let puntaje = similitud(palabrasActividad, palabras(receta.nombre));
    if (normalizarTexto(receta.unidad) === unidadActividad) {
      puntaje += 0.1;
    }

    if (!mejor || puntaje > mejor.puntaje) {
      mejor = { receta, puntaje };
    }
  }

  return mejor;
}

/**
 * Receta aproximada construida con el catálogo de la BD: elige, para cada tipo
 * de recurso, el que más se usa en las recetas existentes (desempate alfabético).
 * Si la BD todavía no tiene recetas, toma el primer recurso activo de cada tipo.
 *
 * La cantidad usada es 1 por unidad de actividad: es un valor neutro, no un
 * rendimiento inventado. El usuario debe ajustar el APU antes de aprobarlo.
 */
export function recetaAproximadaDesdeBd(
  recursos: RecursoApuAutomatico[],
  recetas: RecetaBd[],
  actividadNombre: string = '',
): DetalleApuAutomatico[] {
  if (recursos.length === 0) {
    throw new InternalServerErrorException(
      'No hay recursos activos en el catálogo. Cargue recursos antes de generar un APU automático.',
    );
  }

  const uso = new Map<string, number>();
  for (const receta of recetas) {
    for (const detalle of receta.detalles) {
      uso.set(detalle.recursoId, (uso.get(detalle.recursoId) ?? 0) + 1);
    }
  }

  const palabrasActividad = palabras(actividadNombre);
  const detalles: DetalleApuAutomatico[] = [];

  for (const tipo of ORDEN_TIPOS) {
    const candidatos = recursos.filter((recurso) => recurso.tipo === tipo);
    if (candidatos.length === 0) continue;

    const elegido = candidatos.reduce((mejor, actual) => {
      const palabrasActual = palabras(actual.descripcion);
      const palabrasMejor = palabras(mejor.descripcion);

      let comunActual = 0;
      for (const p of palabrasActividad) {
        if (palabrasActual.has(p)) comunActual++;
      }

      let comunMejor = 0;
      for (const p of palabrasActividad) {
        if (palabrasMejor.has(p)) comunMejor++;
      }

      if (comunActual !== comunMejor) {
        return comunActual > comunMejor ? actual : mejor;
      }

      const usoActual = uso.get(actual.id) ?? 0;
      const usoMejor = uso.get(mejor.id) ?? 0;

      if (usoActual !== usoMejor) {
        return usoActual > usoMejor ? actual : mejor;
      }

      return actual.descripcion.localeCompare(mejor.descripcion, 'es') < 0
        ? actual
        : mejor;
    });

    detalles.push({
      recursoId: elegido.id,
      tipo,
      cantidadPorUnidad: new Prisma.Decimal(1),
    });
  }

  return detalles;
}

/**
 * Genera la receta del APU usando SOLO datos de la BD:
 *  1. Si hay una actividad parecida con `apu_detalle`, copia sus rendimientos.
 *  2. Si no, arma una receta aproximada con el catálogo vigente.
 */
export async function generarApuDesdeBd(
  tx: Prisma.TransactionClient,
  actividad: { id: string; nombre: string; unidad: string },
  recursos: RecursoApuAutomatico[],
  recetasCargadas?: RecetaBd[],
): Promise<ResultadoApuAutomatico> {
  const recursosPorId = new Map(recursos.map((recurso) => [recurso.id, recurso]));

  const recetas =
    recetasCargadas ?? (await cargarRecetasDesdeBd(tx, actividad.id));

  const candidata = elegirRecetaSimilar(actividad, recetas);

  if (candidata && candidata.puntaje >= UMBRAL_COINCIDENCIA) {
    const detalles = candidata.receta.detalles
      .map((detalle) => {
        const recurso = recursosPorId.get(detalle.recursoId);
        // Si el recurso ya no existe o está inactivo, se omite la línea.
        if (!recurso) return null;

        return {
          recursoId: recurso.id,
          tipo: recurso.tipo,
          cantidadPorUnidad: detalle.cantidadPorUnidad,
        };
      })
      .filter((detalle): detalle is DetalleApuAutomatico => detalle !== null);

    if (detalles.length > 0) {
      return {
        metodo: 'referencia',
        referencia: `Rendimiento tomado de la actividad "${candidata.receta.nombre}" del catálogo (coincidencia ${candidata.puntaje.toFixed(2)}). Agregue los recursos propios del proyecto que no aparezcan en esta receta.`,
        detalles,
      };
    }
  }

  return {
    metodo: 'aproximado',
    referencia:
      'Rendimiento aproximado armado con el catálogo de recursos vigente (asociado por palabras clave). Revise las cantidades y agregue los materiales que no tengan precio en el catálogo antes de aprobar el presupuesto.',
    detalles: recetaAproximadaDesdeBd(recursos, recetas, actividad.nombre),
  };
}

/** Costo de la receta calculado en memoria con los precios vigentes. */
export function calcularCacheDesdeDetalles(
  detalles: DetalleApuAutomatico[],
  recursos: RecursoApuAutomatico[],
) {
  const precios: Record<string, Prisma.Decimal> = {};
  for (const recurso of recursos) {
    precios[recurso.id] = recurso.costoUnitario;
  }

  return calcularApu(detalles, precios);
}

/** Guarda (o actualiza) el costo unitario cacheado de una actividad. */
async function guardarCacheApu(
  tx: Prisma.TransactionClient,
  actividadId: string,
  costo: ReturnType<typeof calcularCacheDesdeDetalles>,
) {
  const fechaCalculo = new Date();

  return tx.apuCostoCache.upsert({
    where: { actividadId },
    update: { ...costo, fechaCalculo },
    create: { actividadId, ...costo, fechaCalculo },
  });
}

/**
 * Recalcula el caché de una actividad leyendo su receta actual de la BD.
 * Se usa al crear, editar o borrar un detalle de APU.
 */
export async function recalcularCacheApu(
  tx: Prisma.TransactionClient,
  actividadId: string,
) {
  const receta = await tx.apuDetalle.findMany({
    where: { actividadId },
    include: { recurso: { select: { tipo: true, costoUnitario: true } } },
  });

  const preciosMap: Record<string, Prisma.Decimal> = {};
  const detalles = receta.map((detalle) => {
    preciosMap[detalle.recursoId] = detalle.recurso.costoUnitario;
    return {
      recursoId: detalle.recursoId,
      tipo: detalle.recurso.tipo,
      cantidadPorUnidad: detalle.cantidadPorUnidad,
    };
  });

  return guardarCacheApu(
    tx,
    actividadId,
    calcularApu(detalles, preciosMap),
  );
}

/**
 * Crea la receta del APU y su caché dentro de una transacción abierta.
 *
 * El costo se calcula en memoria con los `recursos` que ya vienen cargados,
 * así no se hace una consulta extra por actividad (fue la causa del error
 * P2028 al importar pliegos grandes).
 *
 * No borra detalles previos: los llamadores lo usan solo cuando la actividad
 * todavía no tiene APU (`activities.service` la acaba de crear y
 * `apus.service` verifica que `apuDetalles` esté vacío).
 *
 * @param recetasCargadas recetas ya leídas de la BD; si se omite, se consultan.
 */
export async function crearApuAutomaticoEnTransaccion(
  tx: Prisma.TransactionClient,
  actividad: { id: string; nombre: string; unidad: string },
  recursos: RecursoApuAutomatico[],
  _cantidadProyecto: Prisma.Decimal | number | string = 1,
  recetasCargadas?: RecetaBd[],
) {
  const resultado = await generarApuDesdeBd(
    tx,
    actividad,
    recursos,
    recetasCargadas,
  );

  if (resultado.detalles.length === 0) {
    throw new InternalServerErrorException(
      `No se pudo generar el APU de "${actividad.nombre}": el catálogo de recursos no tiene líneas utilizables.`,
    );
  }

  await tx.apuDetalle.createMany({
    data: resultado.detalles.map((detalle) => ({
      actividadId: actividad.id,
      recursoId: detalle.recursoId,
      cantidadPorUnidad: detalle.cantidadPorUnidad,
    })),
  });

  const cache = await guardarCacheApu(
    tx,
    actividad.id,
    calcularCacheDesdeDetalles(resultado.detalles, recursos),
  );

  return { ...resultado, cache };
}
