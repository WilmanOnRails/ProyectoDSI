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
  pctAdministracion: Decimal | number | string;
  pctUtilidad: Decimal | number | string;
  pctImpuestos: Decimal | number | string;
  pctImprevistos?: Decimal | number | string;
}

export interface ResultadoPresupuesto {
  costosDirectos: Decimal;
  indirectos: Decimal;
  administracion: Decimal;
  utilidad: Decimal;
  imprevistos: Decimal;
  subtotalNeto: Decimal;
  impuestos: Decimal;
  total: Decimal;
}

/** Datos mínimos de una línea de presupuesto para calcular sus totales. */
export interface ItemPresupuestoCalculo {
  cantidadProyecto: Decimal | number | string;
  costoMaterialesCong: Decimal | number | string;
  costoManoObraCong: Decimal | number | string;
  costoEquipoCong: Decimal | number | string;
  costoTransporteCong: Decimal | number | string;
}

export interface TotalesLineaPresupuesto {
  totalMateriales: Decimal;
  totalManoObra: Decimal;
  totalEquipo: Decimal;
  totalTransporte: Decimal;
  sumaTotal: Decimal;
}

export interface ResultadoResumenPresupuesto extends ResultadoPresupuesto {
  costoMateriales: Decimal;
  costoManoObra: Decimal;
  costoEquipo: Decimal;
  costoTransporte: Decimal;
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
 * Calcula los totales de un presupuesto aplicando los porcentajes EN CASCADA.
 *
 * Fórmula (cada porcentaje se aplica sobre el acumulado anterior):
 *   a = Costo directo
 *   b = Indirectos     = ROUND(a * %indirectos, 2)
 *   c = Administración = ROUND((a + b) * %administracion, 2)
 *   d = Utilidad       = ROUND((a + b + c) * %utilidad, 2)
 *   i = Imprevistos    = ROUND((a + b + c + d) * %imprevistos, 2)
 *   e = Subtotal neto  = a + b + c + d + i
 *   IVA                = ROUND(e * %impuestos, 2)
 *   Total              = e + IVA
 *
 * Cada línea del resumen se redondea a 2 decimales y el subtotal/total se
 * construyen sumando los valores ya redondeados.
 */
export function calcularTotalesPresupuesto(
  directos: Decimal | number | string,
  porcentajes: PorcentajesPresupuesto,
): ResultadoPresupuesto {
  const a = redondear(d(directos));

  const b = redondear(a.mul(pct(porcentajes.pctIndirectos)));
  const c = redondear(a.add(b).mul(pct(porcentajes.pctAdministracion)));
  const dUtilidad = redondear(a.add(b).add(c).mul(pct(porcentajes.pctUtilidad)));
  const i = redondear(
    a.add(b).add(c).add(dUtilidad).mul(pct(porcentajes.pctImprevistos ?? 0)),
  );
  const e = redondear(a.add(b).add(c).add(dUtilidad).add(i));
  const iva = redondear(e.mul(pct(porcentajes.pctImpuestos)));
  const total = redondear(e.add(iva));

  return {
    costosDirectos: a,
    indirectos: b,
    administracion: c,
    utilidad: dUtilidad,
    imprevistos: i,
    subtotalNeto: e,
    impuestos: iva,
    total,
  };
}

// ---------------------------------------------------------------------------
// calcularTotalesLinea
// ---------------------------------------------------------------------------

/**
 * Calcula los totales de UNA línea del desglose.
 *
 * Cada categoría se multiplica por la cantidad del proyecto y se redondea a
 * 2 decimales. La "Suma Total" es la suma de esas cuatro categorías ya
 * redondeadas, para que capítulos y costo directo cuadren exactamente con lo
 * que se muestra en pantalla.
 */
export function calcularTotalesLinea(
  item: ItemPresupuestoCalculo,
): TotalesLineaPresupuesto {
  const cant = d(item.cantidadProyecto);

  const totalMateriales = redondear(d(item.costoMaterialesCong).mul(cant));
  const totalManoObra = redondear(d(item.costoManoObraCong).mul(cant));
  const totalEquipo = redondear(d(item.costoEquipoCong).mul(cant));
  const totalTransporte = redondear(d(item.costoTransporteCong).mul(cant));

  return {
    totalMateriales,
    totalManoObra,
    totalEquipo,
    totalTransporte,
    sumaTotal: redondear(
      totalMateriales
        .add(totalManoObra)
        .add(totalEquipo)
        .add(totalTransporte),
    ),
  };
}

// ---------------------------------------------------------------------------
// calcularResumenPresupuesto
// ---------------------------------------------------------------------------

/**
 * ÚNICA fuente de verdad para el costo directo y el resumen en cascada.
 *
 * Recorre las líneas del presupuesto, calcula sus totales con
 * `calcularTotalesLinea` y suma esos valores. El costo directo es, por
 * definición, la suma de las "Suma Total" de todas las líneas.
 */
export function calcularResumenPresupuesto(
  items: ItemPresupuestoCalculo[],
  porcentajes: PorcentajesPresupuesto,
): ResultadoResumenPresupuesto {
  let costoMateriales = new Decimal(0);
  let costoManoObra = new Decimal(0);
  let costoEquipo = new Decimal(0);
  let costoTransporte = new Decimal(0);
  let costosDirectos = new Decimal(0);

  for (const item of items) {
    const linea = calcularTotalesLinea(item);
    costoMateriales = costoMateriales.add(linea.totalMateriales);
    costoManoObra = costoManoObra.add(linea.totalManoObra);
    costoEquipo = costoEquipo.add(linea.totalEquipo);
    costoTransporte = costoTransporte.add(linea.totalTransporte);
    costosDirectos = costosDirectos.add(linea.sumaTotal);
  }

  const totales = calcularTotalesPresupuesto(costosDirectos, porcentajes);

  return {
    ...totales,
    costoMateriales,
    costoManoObra,
    costoEquipo,
    costoTransporte,
  };
}
