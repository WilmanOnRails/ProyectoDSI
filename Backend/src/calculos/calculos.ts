import { Decimal } from '@prisma/client/runtime/library';

// ---------------------------------------------------------------------------
// Tipos auxiliares (sin depender de Prisma directamente, para que los tests
// sean rápidos y no necesiten base de datos).
// ---------------------------------------------------------------------------

export interface DetalleApu {
  /** ID del recurso */
  recursoId: string;
  /** Tipo: 'material' | 'mano_obra' | 'equipo' | 'transporte' */
  tipo: string;
  /** Cantidad de este recurso por 1 unidad de actividad */
  cantidadPorUnidad: Decimal | number | string;
}

export interface ResultadoApu {
  costoMateriales: Decimal;
  costoManoObra: Decimal;
  costoEquipo: Decimal;
  costoTransporte: Decimal;
  costoTotal: Decimal;
}

export interface PorcentajesPresupuesto {
  pctIndirectos: Decimal | number | string;
  pctUtilidad: Decimal | number | string;
  pctImpuestos: Decimal | number | string;
}

export interface ResultadoPresupuesto {
  costosDirectos: Decimal;
  indirectos: Decimal;
  utilidad: Decimal;
  impuestos: Decimal;
  total: Decimal;
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Convierte cualquier valor numérico a Decimal para operar sin floats. */
function d(valor: Decimal | number | string): Decimal {
  return new Decimal(valor.toString());
}

/** Divide un porcentaje (ej. 15) entre 100 y lo convierte en Decimal. */
function pct(porcentaje: Decimal | number | string): Decimal {
  return d(porcentaje).div(100);
}

/** Redondea a 2 decimales (moneda). */
function redondear(valor: Decimal): Decimal {
  return valor.toDecimalPlaces(2);
}

// ---------------------------------------------------------------------------
// calcularApu
// ---------------------------------------------------------------------------

/**
 * Calcula el costo unitario de una actividad agrupado por tipo de recurso.
 *
 * Fórmula: para cada detalle → cantidad × precio_vigente del recurso.
 * Los costos se acumulan por tipo y se redondean AL FINAL (no en cada línea)
 * para evitar pérdida de precisión.
 *
 * @param detalles  - Filas de apu_detalle de la actividad.
 * @param precios   - Mapa { recursoId → precio_vigente } — viene de Recurso.costoUnitario.
 *
 * @example
 * const resultado = calcularApu(
 *   [{ recursoId: 'r1', tipo: 'material', cantidadPorUnidad: 5 }],
 *   { r1: new Decimal('495') },
 * );
 * // resultado.costoMateriales → Decimal('2475.00')
 * // resultado.costoTotal      → Decimal('2475.00')
 */
export function calcularApu(
  detalles: DetalleApu[],
  precios: Record<string, Decimal>,
): ResultadoApu {
  let materiales = new Decimal(0);
  let manoObra = new Decimal(0);
  let equipo = new Decimal(0);
  let transporte = new Decimal(0);

  for (const det of detalles) {
    const precio = precios[det.recursoId];

    // Si no viene el precio (recurso eliminado o faltante) se ignora la línea.
    if (!precio) continue;

    const subtotal = d(det.cantidadPorUnidad).mul(d(precio));

    switch (det.tipo) {
      case 'material':
        materiales = materiales.add(subtotal);
        break;
      case 'mano_obra':
        manoObra = manoObra.add(subtotal);
        break;
      case 'equipo':
        equipo = equipo.add(subtotal);
        break;
      case 'transporte':
        transporte = transporte.add(subtotal);
        break;
      // tipo desconocido → se ignora (no debe ocurrir si el schema está bien)
    }
  }

  const costoMateriales = redondear(materiales);
  const costoManoObra = redondear(manoObra);
  const costoEquipo = redondear(equipo);
  const costoTransporte = redondear(transporte);
  const costoTotal = redondear(
    costoMateriales.add(costoManoObra).add(costoEquipo).add(costoTransporte),
  );

  return {
    costoMateriales,
    costoManoObra,
    costoEquipo,
    costoTransporte,
    costoTotal,
  };
}

// ---------------------------------------------------------------------------
// calcularTotalesPresupuesto
// ---------------------------------------------------------------------------

/**
 * Calcula los totales de un presupuesto aplicando los porcentajes EN CASCADA
 * (según el diseño del Figma y AGENTS.md punto 5):
 *
 *   indirectos = directos          × pctIndirectos
 *   utilidad   = (dir + ind)       × pctUtilidad
 *   impuestos  = (dir + ind + ut)  × pctImpuestos
 *   total      = dir + ind + ut + imp
 *
 * Ejemplo verificado:
 *   directos = 18,450,000 | 15 / 10 / 15
 *   indirectos = 18,450,000 × 0.15 = 2,767,500
 *   utilidad   = 21,217,500 × 0.10 = 2,121,750
 *   impuestos  = 23,339,250 × 0.15 = 3,500,887.50
 *   total      = 26,840,137.50  ✓
 *
 * @param directos    - Suma de (cantidad_proyecto × costo_unitario_congelado).
 * @param porcentajes - { pctIndirectos, pctUtilidad, pctImpuestos } como números 0-100.
 */
export function calcularTotalesPresupuesto(
  directos: Decimal | number | string,
  porcentajes: PorcentajesPresupuesto,
): ResultadoPresupuesto {
  const dir = d(directos);

  const indirectos = redondear(dir.mul(pct(porcentajes.pctIndirectos)));
  const utilidad = redondear(
    dir.add(indirectos).mul(pct(porcentajes.pctUtilidad)),
  );
  const impuestos = redondear(
    dir.add(indirectos).add(utilidad).mul(pct(porcentajes.pctImpuestos)),
  );
  const total = redondear(dir.add(indirectos).add(utilidad).add(impuestos));

  return {
    costosDirectos: redondear(dir),
    indirectos,
    utilidad,
    impuestos,
    total,
  };
}
