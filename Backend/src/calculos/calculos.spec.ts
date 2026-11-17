import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it } from 'vitest';
import {
  calcularApu,
  calcularLineaDesdeApu,
  calcularResumenPresupuesto,
  calcularTotalesLinea,
  calcularTotalesPresupuesto,
  type DetalleApu,
} from './calculos.js';

// ---------------------------------------------------------------------------
// Los tests NO usan datos del catálogo ni de ningún pliego: los precios,
// cantidades y recetas reales viven en la base de datos. Acá solo se comprueba
// la FÓRMULA, con valores sintéticos mínimos.
// ---------------------------------------------------------------------------
const d = (v: number | string) => new Decimal(v.toString());

/** Costo que genera un detalle: cantidad × precio. */
const TIPOS = ['material', 'mano_obra', 'equipo', 'transporte'] as const;

// ---------------------------------------------------------------------------
// calcularApu
// ---------------------------------------------------------------------------
describe('calcularApu', () => {
  it('multiplica cantidad por precio y agrupa por tipo', () => {
    const cantidad = 2;
    const precio = 10;
    const detalles: DetalleApu[] = TIPOS.map((tipo, i) => ({
      recursoId: `r${i}`,
      tipo,
      cantidadPorUnidad: cantidad + i,
    }));
    const precios = Object.fromEntries(
      TIPOS.map((_, i) => [`r${i}`, d(precio)]),
    );

    const result = calcularApu(detalles, precios);

    // 2×10, 3×10, 4×10, 5×10
    expect(result.costoMateriales.toString()).toBe('20');
    expect(result.costoManoObra.toString()).toBe('30');
    expect(result.costoEquipo.toString()).toBe('40');
    expect(result.costoTransporte.toString()).toBe('50');
    expect(result.costoTotal.toString()).toBe('140');
  });

  it('redondea a 2 decimales sin acumular floats', () => {
    const detalles: DetalleApu[] = [
      { recursoId: 'r', tipo: 'material', cantidadPorUnidad: '1' },
    ];

    const result = calcularApu(detalles, { r: d('10.005') });

    expect(result.costoMateriales.toString()).toBe('10.01');
    expect(result.costoTotal.toString()).toBe('10.01');
  });

  it('suma varios detalles del mismo tipo antes de redondear', () => {
    const detalles: DetalleApu[] = [
      { recursoId: 'r1', tipo: 'material', cantidadPorUnidad: '0.001' },
      { recursoId: 'r2', tipo: 'material', cantidadPorUnidad: '0.001' },
      { recursoId: 'r3', tipo: 'material', cantidadPorUnidad: '0.001' },
    ];
    const precios = { r1: d('0.004'), r2: d('0.004'), r3: d('0.004') };

    const result = calcularApu(detalles, precios);

    // 0.000012 × 3 = 0.000036 → 0.00 (redondeo solo al final)
    expect(result.costoTotal.toString()).toBe('0');
  });

  it('devuelve ceros si la lista de detalles está vacía', () => {
    const result = calcularApu([], {});

    expect(result.costoMateriales.toString()).toBe('0');
    expect(result.costoManoObra.toString()).toBe('0');
    expect(result.costoEquipo.toString()).toBe('0');
    expect(result.costoTransporte.toString()).toBe('0');
    expect(result.costoTotal.toString()).toBe('0');
  });

  it('ignora detalles cuyo recurso no tiene precio', () => {
    const detalles: DetalleApu[] = [
      { recursoId: 'existe', tipo: 'material', cantidadPorUnidad: 1 },
      { recursoId: 'no-existe', tipo: 'material', cantidadPorUnidad: 1 },
    ];

    const result = calcularApu(detalles, { existe: d(5) });

    expect(result.costoMateriales.toString()).toBe('5');
    expect(result.costoTotal.toString()).toBe('5');
  });

  it('acepta cantidades y precios como Decimal', () => {
    const detalles: DetalleApu[] = [
      { recursoId: 'r', tipo: 'mano_obra', cantidadPorUnidad: d(2) },
    ];

    const result = calcularApu(detalles, { r: d('0.5') });

    expect(result.costoManoObra.toString()).toBe('1');
  });
});

// ---------------------------------------------------------------------------
// calcularTotalesPresupuesto (cascada)
// ---------------------------------------------------------------------------
describe('calcularTotalesPresupuesto', () => {
  const pct = (porcentaje: number) => porcentaje;

  it('aplica cada porcentaje sobre el acumulado anterior (cascada)', () => {
    const result = calcularTotalesPresupuesto(100, {
      pctIndirectos: pct(10),
      pctAdministracion: pct(10),
      pctUtilidad: pct(10),
      pctImprevistos: pct(0),
      pctImpuestos: pct(10),
    });

    expect(result.costosDirectos.toString()).toBe('100');
    expect(result.indirectos.toString()).toBe('10');
    expect(result.administracion.toString()).toBe('11');
    expect(result.utilidad.toString()).toBe('12.1');
    expect(result.imprevistos.toString()).toBe('0');
    expect(result.subtotalNeto.toString()).toBe('133.1');
    expect(result.impuestos.toString()).toBe('13.31');
    expect(result.total.toString()).toBe('146.41');
  });

  it('no es un cálculo en paralelo', () => {
    const cascada = calcularTotalesPresupuesto(100, {
      pctIndirectos: 10,
      pctAdministracion: 0,
      pctUtilidad: 10,
      pctImprevistos: 0,
      pctImpuestos: 10,
    });

    // Paralelo daría 100 + 10 + 10 + 10 = 130
    expect(cascada.total.toString()).toBe('133.1');
    expect(cascada.total.toString()).not.toBe('130');
  });

  it('incluye imprevistos en la cascada', () => {
    const result = calcularTotalesPresupuesto(100, {
      pctIndirectos: 0,
      pctAdministracion: 0,
      pctUtilidad: 0,
      pctImprevistos: 10,
      pctImpuestos: 0,
    });

    expect(result.imprevistos.toString()).toBe('10');
    expect(result.total.toString()).toBe('110');
  });

  it('con 0 % el total es igual al costo directo', () => {
    const result = calcularTotalesPresupuesto(100, {
      pctIndirectos: 0,
      pctAdministracion: 0,
      pctUtilidad: 0,
      pctImprevistos: 0,
      pctImpuestos: 0,
    });

    expect(result.total.toString()).toBe('100');
  });

  it('con costo directo 0 todo queda en 0', () => {
    const result = calcularTotalesPresupuesto(0, {
      pctIndirectos: 10,
      pctAdministracion: 10,
      pctUtilidad: 10,
      pctImprevistos: 0,
      pctImpuestos: 10,
    });

    expect(result.total.toString()).toBe('0');
  });

  it('acepta porcentajes con decimales', () => {
    const result = calcularTotalesPresupuesto(100, {
      pctIndirectos: '12.5',
      pctAdministracion: 0,
      pctUtilidad: '8.75',
      pctImprevistos: 0,
      pctImpuestos: '15',
    });

    expect(result.indirectos.toString()).toBe('12.5');
    expect(result.utilidad.toString()).toBe('9.84');
    expect(result.impuestos.toString()).toBe('18.35');
    expect(result.total.toString()).toBe('140.69');
  });
});

// ---------------------------------------------------------------------------
// calcularTotalesLinea: P.U. = importe ÷ cantidad, total = P.U. × cantidad
// ---------------------------------------------------------------------------
describe('calcularTotalesLinea', () => {
  it('divide el importe entre la cantidad para obtener el P.U.', () => {
    const cantidad = 4;
    const importe = 100;

    const linea = calcularTotalesLinea({
      cantidadProyecto: cantidad,
      costoMaterialesCong: importe,
      costoManoObraCong: importe / 2,
      costoEquipoCong: 0,
      costoTransporteCong: 0,
    });

    expect(linea.puMateriales.toString()).toBe('25');
    expect(linea.puManoObra.toString()).toBe('12.5');
    expect(linea.totalMateriales.toString()).toBe('100');
    expect(linea.totalManoObra.toString()).toBe('50');
    expect(linea.sumaTotal.toString()).toBe('150');
  });

  it('reconstruye el total multiplicando el P.U. por la cantidad', () => {
    const cantidad = 3;
    const importe = 100;

    const linea = calcularTotalesLinea({
      cantidadProyecto: cantidad,
      costoMaterialesCong: importe,
      costoManoObraCong: 0,
      costoEquipoCong: 0,
      costoTransporteCong: 0,
    });

    expect(linea.puMateriales.toString()).toBe('33.333333');
    expect(linea.totalMateriales.toString()).toBe('100');
  });

  it('si la cantidad es 0 el P.U. y los totales quedan en 0', () => {
    const linea = calcularTotalesLinea({
      cantidadProyecto: 0,
      costoMaterialesCong: 10,
      costoManoObraCong: 20,
      costoEquipoCong: 30,
      costoTransporteCong: 40,
    });

    expect(linea.puTotal.toString()).toBe('0');
    expect(linea.sumaTotal.toString()).toBe('0');
  });

  it('el P.U. total es la suma de los P.U. de las cuatro categorías', () => {
    const linea = calcularTotalesLinea({
      cantidadProyecto: 1,
      costoMaterialesCong: 1,
      costoManoObraCong: 2,
      costoEquipoCong: 3,
      costoTransporteCong: 4,
    });

    expect(linea.puTotal.toString()).toBe('10');
    expect(linea.sumaTotal.toString()).toBe('10');
  });
});

// ---------------------------------------------------------------------------
// calcularResumenPresupuesto: suma todas las líneas y aplica la cascada
// ---------------------------------------------------------------------------
describe('calcularResumenPresupuesto', () => {
  const item = (cantidad: number, importe: number) => ({
    cantidadProyecto: cantidad,
    costoMaterialesCong: importe,
    costoManoObraCong: 0,
    costoEquipoCong: 0,
    costoTransporteCong: 0,
  });

  const sinPorcentajes = {
    pctIndirectos: 0,
    pctAdministracion: 0,
    pctUtilidad: 0,
    pctImprevistos: 0,
    pctImpuestos: 0,
  };

  it('el costo directo es la suma de la Suma Total de TODAS las líneas', () => {
    const resumen = calcularResumenPresupuesto(
      [item(2, 100), item(5, 50), item(1, 25)],
      sinPorcentajes,
    );

    expect(resumen.costosDirectos.toString()).toBe('175');
    expect(resumen.total.toString()).toBe('175');
  });

  it('no depende del orden de las líneas', () => {
    const lineas = [item(2, 100), item(5, 50), item(1, 25)];

    const directo = calcularResumenPresupuesto(lineas, sinPorcentajes);
    const invertido = calcularResumenPresupuesto(
      [...lineas].reverse(),
      sinPorcentajes,
    );

    expect(directo.costosDirectos.toString()).toBe(
      invertido.costosDirectos.toString(),
    );
  });

  it('sin líneas el presupuesto queda en 0', () => {
    const resumen = calcularResumenPresupuesto([], sinPorcentajes);

    expect(resumen.costosDirectos.toString()).toBe('0');
    expect(resumen.total.toString()).toBe('0');
  });

  it('aplica la cascada sobre el costo directo de todas las líneas', () => {
    const resumen = calcularResumenPresupuesto([item(1, 100), item(1, 100)], {
      pctIndirectos: 10,
      pctAdministracion: 0,
      pctUtilidad: 0,
      pctImprevistos: 0,
      pctImpuestos: 0,
    });

    expect(resumen.costosDirectos.toString()).toBe('200');
    expect(resumen.indirectos.toString()).toBe('20');
    expect(resumen.total.toString()).toBe('220');
  });
});

// ---------------------------------------------------------------------------
// calcularLineaDesdeApu: copia lo que viene del APU y suma el importe
// ---------------------------------------------------------------------------
describe('calcularLineaDesdeApu', () => {
  const cache = {
    costoMateriales: 1,
    costoManoObra: 2,
    costoEquipo: 3,
    costoTransporte: 4,
    costoTotal: 10,
  };

  it('copia el importe del APU sin transformarlo', () => {
    const linea = calcularLineaDesdeApu(cache);

    expect(linea.costoMaterialesCong.toString()).toBe('1');
    expect(linea.costoManoObraCong.toString()).toBe('2');
    expect(linea.costoEquipoCong.toString()).toBe('3');
    expect(linea.costoTransporteCong.toString()).toBe('4');
    expect(linea.costoUnitarioCongelado.toString()).toBe('10');
  });

  it('el total de la línea es la suma de las cuatro categorías', () => {
    const linea = calcularLineaDesdeApu(cache);

    expect(linea.total.toString()).toBe('10');
  });

  it('al pasarla por calcularTotalesLinea da el P.U. y los totales', () => {
    const cantidad = 2;
    const linea = calcularLineaDesdeApu(cache);
    const totales = calcularTotalesLinea({ cantidadProyecto: cantidad, ...linea });

    expect(totales.puMateriales.toString()).toBe('0.5');
    expect(totales.puManoObra.toString()).toBe('1');
    expect(totales.puEquipo.toString()).toBe('1.5');
    expect(totales.puTransporte.toString()).toBe('2');
    expect(totales.totalMateriales.toString()).toBe('1');
    expect(totales.totalTransporte.toString()).toBe('4');
    expect(totales.sumaTotal.toString()).toBe('10');
  });

  it('redondea el importe a 2 decimales', () => {
    const linea = calcularLineaDesdeApu({
      costoMateriales: '1.005',
      costoManoObra: 0,
      costoEquipo: 0,
      costoTransporte: 0,
      costoTotal: '1.005',
    });

    expect(linea.costoMaterialesCong.toString()).toBe('1.01');
    expect(linea.total.toString()).toBe('1.01');
  });
});
