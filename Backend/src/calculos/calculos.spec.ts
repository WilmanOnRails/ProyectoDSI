import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it } from 'vitest';
import {
  calcularApu,
  calcularResumenPresupuesto,
  calcularTotalesPresupuesto,
  type DetalleApu,
} from './calculos.js';

// ---------------------------------------------------------------------------
// Helpers para tests
// ---------------------------------------------------------------------------
function dec(v: number | string): Decimal {
  return new Decimal(v.toString());
}

// ---------------------------------------------------------------------------
// calcularApu
// ---------------------------------------------------------------------------
describe('calcularApu', () => {
  it('debe agrupar costos por tipo y redondear a 2 decimales', () => {
    const detalles: DetalleApu[] = [
      { recursoId: 'r1', tipo: 'material', cantidadPorUnidad: 5 },
      { recursoId: 'r2', tipo: 'material', cantidadPorUnidad: '2.5' },
      { recursoId: 'r3', tipo: 'mano_obra', cantidadPorUnidad: 8 },
      { recursoId: 'r4', tipo: 'equipo', cantidadPorUnidad: 1 },
      { recursoId: 'r5', tipo: 'transporte', cantidadPorUnidad: 3 },
    ];

    const precios: Record<string, Decimal> = {
      r1: dec(100),
      r2: dec(200),
      r3: dec(150),
      r4: dec(500),
      r5: dec(80),
    };

    const result = calcularApu(detalles, precios);

    // materiales: 5*100 + 2.5*200 = 500 + 500 = 1000
    expect(result.costoMateriales.toNumber()).toBe(1000);
    // mano_obra: 8*150 = 1200
    expect(result.costoManoObra.toNumber()).toBe(1200);
    // equipo: 1*500 = 500
    expect(result.costoEquipo.toNumber()).toBe(500);
    // transporte: 3*80 = 240
    expect(result.costoTransporte.toNumber()).toBe(240);
    // total: 1000 + 1200 + 500 + 240 = 2940
    expect(result.costoTotal.toNumber()).toBe(2940);
  });

  it('debe redondear correctamente valores con muchos decimales', () => {
    const detalles: DetalleApu[] = [
      { recursoId: 'r1', tipo: 'material', cantidadPorUnidad: '0.3333' },
    ];
    const precios: Record<string, Decimal> = {
      r1: dec('100'),
    };

    const result = calcularApu(detalles, precios);

    // 0.3333 * 100 = 33.33
    expect(result.costoMateriales.toString()).toBe('33.33');
    expect(result.costoTotal.toString()).toBe('33.33');
  });

  it('debe devolver ceros si la lista de detalles está vacía', () => {
    const result = calcularApu([], {});

    expect(result.costoMateriales.toNumber()).toBe(0);
    expect(result.costoManoObra.toNumber()).toBe(0);
    expect(result.costoEquipo.toNumber()).toBe(0);
    expect(result.costoTransporte.toNumber()).toBe(0);
    expect(result.costoTotal.toNumber()).toBe(0);
  });

  it('debe ignorar detalles cuyo recurso no tiene precio', () => {
    const detalles: DetalleApu[] = [
      { recursoId: 'r1', tipo: 'material', cantidadPorUnidad: 10 },
      { recursoId: 'inexistente', tipo: 'material', cantidadPorUnidad: 5 },
    ];
    const precios: Record<string, Decimal> = {
      r1: dec(50),
    };

    const result = calcularApu(detalles, precios);

    // Solo r1: 10 * 50 = 500; r_inexistente se ignora
    expect(result.costoMateriales.toNumber()).toBe(500);
    expect(result.costoTotal.toNumber()).toBe(500);
  });

  it('debe aceptar cantidades y precios como Decimal', () => {
    const detalles: DetalleApu[] = [
      {
        recursoId: 'r1',
        tipo: 'mano_obra',
        cantidadPorUnidad: dec('2.75'),
      },
    ];
    const precios: Record<string, Decimal> = {
      r1: dec('333.33'),
    };

    const result = calcularApu(detalles, precios);

    // 2.75 * 333.33 = 916.6575 → redondeado 916.66
    expect(result.costoManoObra.toString()).toBe('916.66');
    expect(result.costoTotal.toString()).toBe('916.66');
  });
});

// ---------------------------------------------------------------------------
// calcularTotalesPresupuesto (cascada con administración)
// ---------------------------------------------------------------------------
describe('calcularTotalesPresupuesto', () => {
  it('debe reproducir el caso del Excel: 4,714,181.35 con 5/8/10/0/17', () => {
    const result = calcularTotalesPresupuesto(4_714_181.35, {
      pctIndirectos: 5,
      pctAdministracion: 8,
      pctUtilidad: 10,
      pctImprevistos: 0,
      pctImpuestos: 17,
    });

    expect(result.costosDirectos.toString()).toBe('4714181.35');
    expect(result.indirectos.toString()).toBe('235709.07');
    expect(result.administracion.toString()).toBe('395991.23');
    expect(result.utilidad.toString()).toBe('534588.17');
    expect(result.imprevistos.toString()).toBe('0');
    expect(result.subtotalNeto.toString()).toBe('5880469.82');
    expect(result.impuestos.toString()).toBe('999679.87');
    expect(result.total.toString()).toBe('6880149.69');
  });

  it('debe aplicar administración después de indirectos y antes de utilidad', () => {
    const result = calcularTotalesPresupuesto(1_000_000, {
      pctIndirectos: 5,
      pctAdministracion: 8,
      pctUtilidad: 10,
      pctImprevistos: 0,
      pctImpuestos: 15,
    });

    expect(result.indirectos.toString()).toBe('50000');
    expect(result.administracion.toString()).toBe('84000');
    expect(result.utilidad.toString()).toBe('113400');
    expect(result.subtotalNeto.toString()).toBe('1247400');
    expect(result.impuestos.toString()).toBe('187110');
    expect(result.total.toString()).toBe('1434510');
  });

  it('debe funcionar con porcentajes 0/0/0/0/0 → total = directos', () => {
    const result = calcularTotalesPresupuesto(1_000_000, {
      pctIndirectos: 0,
      pctAdministracion: 0,
      pctUtilidad: 0,
      pctImprevistos: 0,
      pctImpuestos: 0,
    });

    expect(result.indirectos.toNumber()).toBe(0);
    expect(result.administracion.toNumber()).toBe(0);
    expect(result.utilidad.toNumber()).toBe(0);
    expect(result.impuestos.toNumber()).toBe(0);
    expect(result.total.toNumber()).toBe(1_000_000);
  });

  it('debe funcionar con directos 0 → todo queda en 0', () => {
    const result = calcularTotalesPresupuesto(0, {
      pctIndirectos: 5,
      pctAdministracion: 8,
      pctUtilidad: 10,
      pctImprevistos: 0,
      pctImpuestos: 15,
    });

    expect(result.total.toNumber()).toBe(0);
  });

  it('debe demostrar que el cálculo es en CASCADA, no paralelo', () => {
    const directos = 100_000;

    // Cascada: ind=15000, admin=0, util=(115000)*0.10=11500,
    // imp=(126500)*0.15=18975, total=145475.
    const cascada = calcularTotalesPresupuesto(directos, {
      pctIndirectos: 15,
      pctAdministracion: 0,
      pctUtilidad: 10,
      pctImprevistos: 0,
      pctImpuestos: 15,
    });

    expect(cascada.total.toNumber()).toBe(145475);
    expect(cascada.total.toNumber()).not.toBe(140000); // NO paralelo
  });

  it('debe aceptar porcentajes con decimales', () => {
    const result = calcularTotalesPresupuesto(1_000_000, {
      pctIndirectos: '12.5',
      pctAdministracion: 0,
      pctUtilidad: '8.75',
      pctImprevistos: 0,
      pctImpuestos: '15',
    });

    expect(result.indirectos.toString()).toBe('125000');
    expect(result.utilidad.toString()).toBe('98437.5');
    expect(result.impuestos.toString()).toBe('183515.63');
    expect(result.total.toString()).toBe('1406953.13');
  });
});

// ---------------------------------------------------------------------------
// calcularResumenPresupuesto (costo directo = suma de líneas)
// ---------------------------------------------------------------------------
describe('calcularResumenPresupuesto', () => {
  it('debe sumar las Suma Total de todas las líneas para el costo directo', () => {
    const items = [
      {
        cantidadProyecto: 10,
        costoMaterialesCong: 100,
        costoManoObraCong: 50,
        costoEquipoCong: 20,
        costoTransporteCong: 10,
      },
      {
        cantidadProyecto: 2,
        costoMaterialesCong: 50,
        costoManoObraCong: 25,
        costoEquipoCong: 10,
        costoTransporteCong: 5,
      },
    ];

    const resumen = calcularResumenPresupuesto(items, {
      pctIndirectos: 5,
      pctAdministracion: 8,
      pctUtilidad: 10,
      pctImprevistos: 0,
      pctImpuestos: 15,
    });

    // Línea 1: mat=1000, mo=500, eq=200, tr=100, suma=1800
    // Línea 2: mat=100,  mo=50,  eq=20,  tr=10,  suma=180
    expect(resumen.costoMateriales.toString()).toBe('1100');
    expect(resumen.costoManoObra.toString()).toBe('550');
    expect(resumen.costoEquipo.toString()).toBe('220');
    expect(resumen.costoTransporte.toString()).toBe('110');
    expect(resumen.costosDirectos.toString()).toBe('1980');
  });
});
