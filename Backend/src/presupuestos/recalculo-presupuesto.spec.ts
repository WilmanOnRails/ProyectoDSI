import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  recalcularTotalesPresupuesto,
  sincronizarPresupuestosDeActividad,
  sincronizarPresupuestosDeActividades,
} from './recalculo-presupuesto.js';

const decimal = (valor: string) => new Prisma.Decimal(valor);

/**
 * Línea de presupuesto con el importe congelado del APU (18.00 en total) y
 * cantidad 3. Los números son genéricos, no vienen del catálogo.
 */
function itemDePresupuesto(cantidad: string) {
  return {
    id: 'item-1',
    presupuestoId: 'ppto-1',
    actividadId: 'actividad-1',
    cantidadProyecto: decimal(cantidad),
    costoUnitarioCongelado: decimal('18'),
    costoMaterialesCong: decimal('10'),
    costoManoObraCong: decimal('5'),
    costoEquipoCong: decimal('1'),
    costoTransporteCong: decimal('2'),
    costoSubcontratoCong: decimal('0'),
    total: decimal('18'),
  };
}

describe('recalcularTotalesPresupuesto', () => {
  it('aplica los porcentajes en cascada sobre la suma de las líneas', async () => {
    const tx = {
      presupuesto: {
        findUnique: vi.fn(async () => ({
          id: 'ppto-1',
          items: [itemDePresupuesto('3')],
        })),
        update: vi.fn(async (args: { data: unknown }) => args.data),
      },
      presupuestoItem: { update: vi.fn(async () => ({})) },
      configuracion: { findUnique: vi.fn(async () => null) },
    } as unknown as Prisma.TransactionClient;

    const resultado = await recalcularTotalesPresupuesto(tx, 'ppto-1');

    // 18.00 directos con 5 / 8 / 10 / 0 / 15 %
    expect(resultado?.costosDirectos.toString()).toBe('18');
    expect(resultado?.indirectos.toString()).toBe('0.9');
    expect(resultado?.administracion.toString()).toBe('1.51');
    expect(resultado?.utilidad.toString()).toBe('2.04');
    expect(resultado?.subtotalNeto.toString()).toBe('22.45');
    expect(resultado?.impuestos.toString()).toBe('3.37');
    expect(resultado?.total.toString()).toBe('25.82');
  });
});

describe('sincronizarPresupuestosDeActividades', () => {
  /** APU de cada actividad: 4 columnas + total. */
  const cacheDe = (materiales: string, total: string) => ({
    actividadId: 'actividad',
    costoMateriales: decimal(materiales),
    costoManoObra: decimal('0'),
    costoEquipo: decimal('0'),
    costoTransporte: decimal('0'),
    costoTotal: decimal(total),
    fechaCalculo: new Date(),
  });

  /** Línea del presupuesto con el importe congelado. */
  const lineaDe = (id: string, materiales: string, total: string) => ({
    id,
    presupuestoId: 'ppto-1',
    actividadId: `actividad-${id}`,
    cantidadProyecto: decimal('2'),
    costoUnitarioCongelado: decimal(total),
    costoMaterialesCong: decimal(materiales),
    costoManoObraCong: decimal('0'),
    costoEquipoCong: decimal('0'),
    costoTransporteCong: decimal('0'),
    costoSubcontratoCong: decimal('0'),
    total: decimal(total),
  });

  it('refresca TODAS las líneas del presupuesto, no solo la de la actividad que cambió', async () => {
    const actualizarItem = vi.fn(async (_args: unknown) => ({}));
    const presupuesto = {
      id: 'ppto-1',
      items: [
        {
          ...lineaDe('item-1', '10', '10'),
          actividad: { apuCostoCache: cacheDe('30', '30') },
        },
        {
          ...lineaDe('item-2', '5', '5'),
          actividad: { apuCostoCache: cacheDe('70', '70') },
        },
      ],
    };

    const tx = {
      presupuestoItem: {
        findMany: vi.fn(async () => [{ presupuestoId: 'ppto-1' }]),
        update: actualizarItem,
      },
      presupuesto: {
        findUnique: vi.fn(async () => presupuesto),
        update: vi.fn(async (args: { data: unknown }) => args.data),
      },
      configuracion: { findUnique: vi.fn(async () => null) },
    } as unknown as Prisma.TransactionClient;

    const presupuestos = await sincronizarPresupuestosDeActividad(
      tx,
      'actividad-item-1',
    );

    expect(presupuestos).toEqual(['ppto-1']);
    expect(actualizarItem).toHaveBeenCalledTimes(2);

    // La línea de la actividad tocada toma su APU nuevo (30)...
    const primera = actualizarItem.mock.calls[0][0] as {
      data: { costoMaterialesCong: Prisma.Decimal; total: Prisma.Decimal };
    };
    expect(primera.data.costoMaterialesCong.toString()).toBe('30');
    expect(primera.data.total.toString()).toBe('30');

    // ...y la otra línea también se refresca con su propio APU (70).
    const segunda = actualizarItem.mock.calls[1][0] as {
      data: { costoMaterialesCong: Prisma.Decimal; total: Prisma.Decimal };
    };
    expect(segunda.data.costoMaterialesCong.toString()).toBe('70');
    expect(segunda.data.total.toString()).toBe('70');
  });

  it('recorre cada presupuesto una sola vez aunque cambien varias actividades', async () => {
    const actualizarItem = vi.fn(async (_args: unknown) => ({}));
    const presupuesto = {
      id: 'ppto-1',
      items: [
        {
          ...lineaDe('item-1', '10', '10'),
          actividad: { apuCostoCache: cacheDe('10', '10') },
        },
        {
          ...lineaDe('item-2', '5', '5'),
          actividad: { apuCostoCache: cacheDe('5', '5') },
        },
      ],
    };

    const tx = {
      presupuestoItem: {
        findMany: vi.fn(async () => [
          { presupuestoId: 'ppto-1' },
          { presupuestoId: 'ppto-1' },
        ]),
        update: actualizarItem,
      },
      presupuesto: {
        findUnique: vi.fn(async () => presupuesto),
        update: vi.fn(async (args: { data: unknown }) => args.data),
      },
      configuracion: { findUnique: vi.fn(async () => null) },
    } as unknown as Prisma.TransactionClient;

    await sincronizarPresupuestosDeActividades(tx, ['a', 'b', 'c']);

    // Dos lecturas del presupuesto por refresco (una para las líneas y otra
    // para la cascada), sin importar que hayan cambiado tres actividades.
    expect(tx.presupuesto.findUnique).toHaveBeenCalledTimes(2);
    expect(actualizarItem).toHaveBeenCalledTimes(2);
  });

  it('no toca nada si las actividades no están en ningún presupuesto', async () => {
    const actualizarItem = vi.fn(async () => ({}));
    const tx = {
      presupuestoItem: {
        findMany: vi.fn(async () => []),
        update: actualizarItem,
      },
      presupuesto: { update: vi.fn(async () => ({})) },
    } as unknown as Prisma.TransactionClient;

    const presupuestos = await sincronizarPresupuestosDeActividades(tx, ['a']);

    expect(presupuestos).toEqual([]);
    expect(actualizarItem).not.toHaveBeenCalled();
  });
});
