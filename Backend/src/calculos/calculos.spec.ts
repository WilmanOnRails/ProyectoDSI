import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it } from 'vitest';
import {
  calcularApu,
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
// calcularTotalesPresupuesto (cascada)
// ---------------------------------------------------------------------------
describe('calcularTotalesPresupuesto', () => {
  it('debe reproducir el ejemplo de AGENTS.md: 18,450,000 con 15/10/15 → 26,840,137.50', () => {
    const result = calcularTotalesPresupuesto(18_450_000, {
      pctIndirectos: 15,
      pctUtilidad: 10,
      pctImpuestos: 15,
    });

    // indirectos = 18,450,000 × 0.15 = 2,767,500
    expect(result.indirectos.toString()).toBe('2767500');
    // utilidad = (18,450,000 + 2,767,500) × 0.10 = 2,121,750
    expect(result.utilidad.toString()).toBe('2121750');
    // impuestos = (18,450,000 + 2,767,500 + 2,121,750) × 0.15 = 3,500,887.50
    expect(result.impuestos.toString()).toBe('3500887.5');
    // total = 26,840,137.50
    expect(result.total.toString()).toBe('26840137.5');
  });

  it('debe funcionar con porcentajes 0/0/0 → total = directos', () => {
    const result = calcularTotalesPresupuesto(1_000_000, {
      pctIndirectos: 0,
      pctUtilidad: 0,
      pctImpuestos: 0,
    });

    expect(result.indirectos.toNumber()).toBe(0);
    expect(result.utilidad.toNumber()).toBe(0);
    expect(result.impuestos.toNumber()).toBe(0);
    expect(result.total.toNumber()).toBe(1_000_000);
  });

  it('debe funcionar con directos 0 → todo queda en 0', () => {
    const result = calcularTotalesPresupuesto(0, {
      pctIndirectos: 15,
      pctUtilidad: 10,
      pctImpuestos: 15,
    });

    expect(result.total.toNumber()).toBe(0);
  });

  it('debe demostrar que el cálculo es en CASCADA, no paralelo', () => {
    const directos = 100_000;

    // Cascada: ind=15000, ut=(115000)*0.10=11500, imp=(126500)*0.15=18975
    const cascada = calcularTotalesPresupuesto(directos, {
      pctIndirectos: 15,
      pctUtilidad: 10,
      pctImpuestos: 15,
    });

    // Si fuera paralelo (cada % sobre directos):
    // ind=15000, ut=10000, imp=15000, total=140000
    // Pero en cascada el total es: 100000+15000+11500+18975 = 145475
    expect(cascada.total.toNumber()).toBe(145475);
    expect(cascada.total.toNumber()).not.toBe(140000); // NO paralelo
  });

  it('debe aceptar porcentajes con decimales', () => {
    const result = calcularTotalesPresupuesto(1_000_000, {
      pctIndirectos: '12.5',
      pctUtilidad: '8.75',
      pctImpuestos: '15',
    });

    // ind = 1,000,000 × 0.125 = 125,000
    expect(result.indirectos.toString()).toBe('125000');
    // ut = 1,125,000 × 0.0875 = 98,437.50
    expect(result.utilidad.toString()).toBe('98437.5');
    // imp = 1,223,437.50 × 0.15 = 183,515.625 → redondeado 183,515.63
    expect(result.impuestos.toString()).toBe('183515.63');
    // total = 1,406,953.13
    expect(result.total.toString()).toBe('1406953.13');
  });
});
