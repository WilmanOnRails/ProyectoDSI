import { Prisma, TipoRecurso } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  cargarRecetasDesdeBd,
  crearApuAutomaticoEnTransaccion,
  elegirRecetaSimilar,
  generarApuDesdeBd,
  normalizarTexto,
  recalcularCacheApu,
  recetaAproximadaDesdeBd,
  type RecetaBd,
  type RecursoApuAutomatico,
  type ResultadoApuAutomatico,
} from './apu-automatico.js';

// ---------------------------------------------------------------------------
// El módulo no tiene datos de negocio. Las pruebas tampoco: los "recursos" y
// "recetas" de abajo se fabrican con números genéricos, no con el catálogo real,
// así que nada de lo que hay en la BD queda copiado en el código.
// ---------------------------------------------------------------------------

const decimal = (valor: string) => new Prisma.Decimal(valor);

/** Recurso sintético: id y descripción salen del índice, no de un catálogo. */
function recursoDePrueba(
  indice: number,
  tipo: TipoRecurso,
  costo: string,
): RecursoApuAutomatico {
  return {
    id: `recurso-${indice}`,
    tipo,
    descripcion: `Recurso de prueba ${indice}`,
    costoUnitario: decimal(costo),
  };
}

const recursos: RecursoApuAutomatico[] = [
  recursoDePrueba(1, TipoRecurso.material, '1.00'),
  recursoDePrueba(2, TipoRecurso.material, '2.00'),
  recursoDePrueba(3, TipoRecurso.mano_obra, '10.00'),
  recursoDePrueba(4, TipoRecurso.mano_obra, '20.00'),
  recursoDePrueba(5, TipoRecurso.equipo, '100.00'),
  recursoDePrueba(6, TipoRecurso.transporte, '200.00'),
];

function recetaDePrueba(
  sufijo: string,
  unidad: string,
  cantidades: Array<[indiceRecurso: number, cantidad: string]>,
): RecetaBd {
  return {
    actividadId: `actividad-${sufijo}`,
    nombre: `Actividad de prueba ${sufijo}`,
    unidad,
    detalles: cantidades.map(([indice, cantidad]) => ({
      recursoId: `recurso-${indice}`,
      cantidadPorUnidad: decimal(cantidad),
    })),
  };
}

const recetasBd: RecetaBd[] = [
  recetaDePrueba('alfa', 'm2', [
    [3, '0.1000'],
    [5, '0.2000'],
  ]),
  recetaDePrueba('beta', 'm2', [
    [4, '0.3000'],
    [6, '0.4000'],
  ]),
  recetaDePrueba('gamma', 'm3', [
    [4, '0.5000'],
    [2, '0.6000'],
  ]),
];

type FilaReceta = {
  actividadId: string;
  recursoId: string;
  cantidadPorUnidad: Prisma.Decimal;
  actividad: { nombre: string; unidad: string };
};

/**
 * Transacción falsa: imita los métodos de Prisma que usa el módulo.
 * `apuDetalle.findMany` devuelve las recetas indicadas y `upsert` devuelve
 * lo mismo que se habría guardado, para poder verificar el caché.
 */
function crearTxFalsa(recetas: RecetaBd[] = recetasBd) {
  const filas: FilaReceta[] = recetas.flatMap((receta) =>
    receta.detalles.map((detalle) => ({
      actividadId: receta.actividadId,
      recursoId: detalle.recursoId,
      cantidadPorUnidad: detalle.cantidadPorUnidad,
      actividad: { nombre: receta.nombre, unidad: receta.unidad },
    })),
  );

  const findMany = vi.fn(async () => filas);
  const createMany = vi.fn(
    async (_args: {
      data: Array<{
        actividadId: string;
        recursoId: string;
        cantidadPorUnidad: Prisma.Decimal;
      }>;
    }) => ({ count: 0 }),
  );
  const upsert = vi.fn(async (args: { create: unknown }) => args.create);

  return {
    tx: {
      apuDetalle: { findMany, createMany },
      apuCostoCache: { upsert },
    } as unknown as Prisma.TransactionClient,
    findMany,
    createMany,
    upsert,
  };
}

function cantidadDe(resultado: ResultadoApuAutomatico, recursoId: string) {
  return resultado.detalles
    .find((detalle) => detalle.recursoId === recursoId)
    ?.cantidadPorUnidad.toString();
}

// ---------------------------------------------------------------------------

describe('normalizarTexto', () => {
  it('ignora tildes, mayúsculas y signos', () => {
    expect(normalizarTexto('  TEXTO de Prueba.  ')).toBe('texto de prueba');
  });
});

describe('cargarRecetasDesdeBd', () => {
  it('agrupa los apu_detalle por actividad', async () => {
    const { tx } = crearTxFalsa();

    const recetas = await cargarRecetasDesdeBd(tx);

    expect(recetas).toHaveLength(3);
    const alfa = recetas.find((receta) => receta.actividadId === 'actividad-alfa');
    expect(alfa?.nombre).toBe('Actividad de prueba alfa');
    expect(alfa?.unidad).toBe('m2');
    expect(alfa?.detalles).toHaveLength(2);
  });
});

describe('elegirRecetaSimilar', () => {
  it('encuentra la actividad del catálogo con el nombre más parecido', () => {
    const mejor = elegirRecetaSimilar(
      { nombre: 'Actividad de prueba alfa', unidad: 'm2' },
      recetasBd,
    );

    expect(mejor?.receta.actividadId).toBe('actividad-alfa');
    expect(mejor?.puntaje).toBeGreaterThanOrEqual(0.5);
  });

  it('devuelve null cuando la base todavía no tiene recetas', () => {
    expect(elegirRecetaSimilar({ nombre: 'Cualquiera', unidad: 'm2' }, [])).toBeNull();
  });
});

describe('generarApuDesdeBd', () => {
  it('copia los rendimientos guardados en la BD cuando hay coincidencia', async () => {
    const { tx } = crearTxFalsa();

    const resultado = await generarApuDesdeBd(
      tx,
      { id: 'actividad-nueva', nombre: 'Actividad de prueba alfa', unidad: 'm2' },
      recursos,
      recetasBd,
    );

    expect(resultado.metodo).toBe('referencia');
    expect(resultado.referencia).toContain('Actividad de prueba alfa');
    expect(cantidadDe(resultado, 'recurso-3')).toBe('0.1');
    expect(cantidadDe(resultado, 'recurso-5')).toBe('0.2');
  });

  it('consulta la BD cuando no se le pasan las recetas', async () => {
    const { tx, findMany } = crearTxFalsa();

    const resultado = await generarApuDesdeBd(
      tx,
      { id: 'actividad-nueva', nombre: 'Actividad de prueba beta', unidad: 'm2' },
      recursos,
    );

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(resultado.metodo).toBe('referencia');
    expect(cantidadDe(resultado, 'recurso-4')).toBe('0.3');
  });

  it('no reutiliza una receta si solo comparte palabras genéricas', async () => {
    const { tx } = crearTxFalsa();

    const resultado = await generarApuDesdeBd(
      tx,
      { id: 'actividad-nueva', nombre: 'Actividad especial omega', unidad: 'm2' },
      recursos,
      recetasBd,
    );

    // Comparte "actividad" con todas las recetas, pero eso no alcanza para
    // copiar rendimientos ajenos: mejor una receta aproximada y editable.
    expect(resultado.metodo).toBe('aproximado');
  });

  it('arma una receta aproximada con los recursos del catálogo si no hay coincidencia', async () => {
    const { tx } = crearTxFalsa();

    const resultado = await generarApuDesdeBd(
      tx,
      { id: 'actividad-nueva', nombre: 'Documento sin relación', unidad: 'ml' },
      recursos,
      recetasBd,
    );

    expect(resultado.metodo).toBe('aproximado');
    expect(resultado.detalles).toHaveLength(4);
    // Un recurso por tipo, eligiendo el más usado en las recetas de la BD.
    expect(resultado.detalles.map((detalle) => detalle.recursoId)).toEqual([
      'recurso-2',
      'recurso-4',
      'recurso-5',
      'recurso-6',
    ]);
    expect(
      resultado.detalles.every((detalle) => detalle.cantidadPorUnidad.eq(1)),
    ).toBe(true);
  });

  it('omite las líneas de la receta cuyo recurso ya no está en el catálogo', async () => {
    const { tx } = crearTxFalsa();
    const recetaConRecursoBorrado: RecetaBd[] = [
      recetaDePrueba('delta', 'm2', [
        [999, '5'],
        [3, '0.5'],
      ]),
    ];

    const resultado = await generarApuDesdeBd(
      tx,
      { id: 'actividad-nueva', nombre: 'Actividad de prueba delta', unidad: 'm2' },
      recursos,
      recetaConRecursoBorrado,
    );

    expect(resultado.detalles.map((detalle) => detalle.recursoId)).toEqual([
      'recurso-3',
    ]);
  });
});

describe('recetaAproximadaDesdeBd', () => {
  it('falla con un mensaje claro si el catálogo está vacío', () => {
    expect(() => recetaAproximadaDesdeBd([], [])).toThrow(
      /No hay recursos activos en el catálogo/,
    );
  });

  it('sin recetas previas toma un recurso por tipo', () => {
    const detalles = recetaAproximadaDesdeBd(recursos, []);

    expect(detalles.map((detalle) => detalle.recursoId)).toEqual([
      'recurso-1',
      'recurso-3',
      'recurso-5',
      'recurso-6',
    ]);
  });

  it('prioriza recursos cuyas descripciones coinciden con palabras clave del nombre de la actividad', () => {
    const recursosConNombres: RecursoApuAutomatico[] = [
      {
        id: 'mat-1',
        tipo: TipoRecurso.material,
        descripcion: 'Cemento Portland',
        costoUnitario: decimal('10'),
      },
      {
        id: 'mat-2',
        tipo: TipoRecurso.material,
        descripcion: 'Tubo PVC',
        costoUnitario: decimal('5'),
      },
    ];

    const detalles = recetaAproximadaDesdeBd(
      recursosConNombres,
      [],
      'Suministro de Cemento',
    );

    expect(detalles).toHaveLength(1);
    expect(detalles[0].recursoId).toBe('mat-1');
  });
});

describe('crearApuAutomaticoEnTransaccion', () => {
  it('guarda los detalles y el caché calculado con los precios de la BD', async () => {
    const { tx, createMany, upsert } = crearTxFalsa();

    const resultado = await crearApuAutomaticoEnTransaccion(
      tx,
      { id: 'actividad-nueva', nombre: 'Actividad de prueba alfa', unidad: 'm2' },
      recursos,
      1000,
      recetasBd,
    );

    expect(createMany).toHaveBeenCalledTimes(1);
    const filas = createMany.mock.calls[0][0].data;
    expect(
      filas.map((fila) => [
        fila.actividadId,
        fila.recursoId,
        fila.cantidadPorUnidad.toString(),
      ]),
    ).toEqual([
      ['actividad-nueva', 'recurso-3', '0.1'],
      ['actividad-nueva', 'recurso-5', '0.2'],
    ]);

    // 0.1000 × 10.00 = 1.00 (mano de obra) ; 0.2000 × 100.00 = 20.00 (equipo)
    expect(resultado.cache.costoManoObra.toString()).toBe('1');
    expect(resultado.cache.costoEquipo.toString()).toBe('20');
    expect(resultado.cache.costoTotal.toString()).toBe('21');
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});

describe('recalcularCacheApu', () => {
  it('recalcula desde la receta guardada y hace upsert del caché', async () => {
    const findMany = vi.fn(async () => [
      {
        recursoId: 'recurso-1',
        cantidadPorUnidad: decimal('10'),
        recurso: {
          tipo: TipoRecurso.material,
          costoUnitario: decimal('2'),
        },
      },
    ]);
    const upsert = vi.fn(async (args: { create: unknown }) => args.create);
    const tx = {
      apuDetalle: { findMany },
      apuCostoCache: { upsert },
    } as unknown as Prisma.TransactionClient;

    const cache = await recalcularCacheApu(tx, 'actividad-1');

    expect(cache.costoMateriales.toString()).toBe('20');
    expect(cache.costoTotal.toString()).toBe('20');
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
