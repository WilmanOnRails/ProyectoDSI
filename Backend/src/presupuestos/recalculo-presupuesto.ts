import { Prisma } from '@prisma/client';
import {
  calcularLineaDesdeApu,
  calcularResumenPresupuesto,
  calcularTotalesLinea,
  type PorcentajesPresupuesto,
} from '../calculos/calculos.js';

/** La configuración es un registro único (singleton): siempre se usa el id 1. */
const ID_CONFIGURACION = 1;

type ConfiguracionPorcentajes = {
  pctIndirectosDef: Prisma.Decimal;
  pctAdministracionDef: Prisma.Decimal;
  pctUtilidadDef: Prisma.Decimal;
  pctImpuestosDef: Prisma.Decimal;
  pctImprevistosDef: Prisma.Decimal;
} | null;

/**
 * Lee los porcentajes del módulo de Configuración (BD).
 * Si todavía no existe el registro, usa los valores por defecto del sistema.
 */
export function porcentajesDesdeConfig(
  config: ConfiguracionPorcentajes,
): PorcentajesPresupuesto {
  return {
    pctIndirectos: config?.pctIndirectosDef ?? new Prisma.Decimal(5),
    pctAdministracion: config?.pctAdministracionDef ?? new Prisma.Decimal(8),
    pctUtilidad: config?.pctUtilidadDef ?? new Prisma.Decimal(10),
    pctImprevistos: config?.pctImprevistosDef ?? new Prisma.Decimal(0),
    pctImpuestos: config?.pctImpuestosDef ?? new Prisma.Decimal(15),
  };
}

/**
 * Recalcula los costos directos y aplica la fórmula en CASCADA
 * usando la función pura `calcularResumenPresupuesto`.
 *
 * El costo directo se obtiene SIEMPRE de la suma de las líneas
 * (Total Mat + Total M.O. + Total Eq. + Total Trans).
 */
export async function recalcularTotalesPresupuesto(
  tx: Prisma.TransactionClient,
  presupuestoId: string,
) {
  const presupuesto = await tx.presupuesto.findUnique({
    where: { id: presupuestoId },
    include: { items: true },
  });

  if (!presupuesto) return null;

  // Los porcentajes se toman SIEMPRE del módulo de Configuración.
  const config = await tx.configuracion.findUnique({
    where: { id: ID_CONFIGURACION },
  });
  const porcentajes = porcentajesDesdeConfig(config);

  // Mantenemos PresupuestoItem.total sincronizado con la suma de sus
  // componentes. La fuente de verdad sigue siendo la suma de líneas.
  for (const item of presupuesto.items) {
    const linea = calcularTotalesLinea(item);
    if (!item.total.equals(linea.sumaTotal)) {
      await tx.presupuestoItem.update({
        where: { id: item.id },
        data: { total: linea.sumaTotal },
      });
    }
  }

  const resumen = calcularResumenPresupuesto(presupuesto.items, porcentajes);

  return tx.presupuesto.update({
    where: { id: presupuestoId },
    data: {
      pctIndirectos: porcentajes.pctIndirectos,
      pctAdministracion: porcentajes.pctAdministracion,
      pctUtilidad: porcentajes.pctUtilidad,
      pctImprevistos: porcentajes.pctImprevistos,
      pctImpuestos: porcentajes.pctImpuestos,
      costosDirectos: resumen.costosDirectos,
      costoMateriales: resumen.costoMateriales,
      costoManoObra: resumen.costoManoObra,
      costoEquipo: resumen.costoEquipo,
      costoTransporte: resumen.costoTransporte,
      indirectos: resumen.indirectos,
      administracion: resumen.administracion,
      utilidad: resumen.utilidad,
      imprevistos: resumen.imprevistos,
      subtotalNeto: resumen.subtotalNeto,
      impuestos: resumen.impuestos,
      total: resumen.total,
    },
  });
}

/**
 * Refresca las líneas de UN presupuesto con el costo actual de cada APU.
 * Equivale a `POST /presupuestos/:id/sincronizar`.
 */
export async function sincronizarPresupuestoDesdeApus(
  tx: Prisma.TransactionClient,
  presupuestoId: string,
) {
  const presupuesto = await tx.presupuesto.findUnique({
    where: { id: presupuestoId },
    include: {
      items: {
        include: { actividad: { include: { apuCostoCache: true } } },
      },
    },
  });

  if (!presupuesto) return null;

  for (const item of presupuesto.items) {
    const cache = item.actividad.apuCostoCache;
    if (!cache) continue;

    await tx.presupuestoItem.update({
      where: { id: item.id },
      data: calcularLineaDesdeApu(cache),
    });
  }

  return recalcularTotalesPresupuesto(tx, presupuestoId);
}

/**
 * Vuelve a calcular los presupuestos COMPLETOS que usan alguna de estas
 * actividades, tomando el costo vigente de TODOS sus APUs.
 *
 * No se refresca solo la línea de la actividad que cambió: se refresca el
 * presupuesto entero, porque el usuario espera que al tocar un APU (o un
 * precio) se actualicen todas las filas y el total del presupuesto, no una
 * sola línea.
 *
 * `actividadIds` se recibe como lista para que un cambio de precio que afecta
 * a muchas actividades recorra cada presupuesto UNA sola vez.
 */
export async function sincronizarPresupuestosDeActividades(
  tx: Prisma.TransactionClient,
  actividadIds: string[],
): Promise<string[]> {
  if (actividadIds.length === 0) return [];

  const items = await tx.presupuestoItem.findMany({
    where: { actividadId: { in: actividadIds } },
    select: { presupuestoId: true },
  });

  const presupuestoIds = [...new Set(items.map((item) => item.presupuestoId))];

  for (const presupuestoId of presupuestoIds) {
    await sincronizarPresupuestoDesdeApus(tx, presupuestoId);
  }

  return presupuestoIds;
}

/**
 * Igual que `sincronizarPresupuestosDeActividades`, pero para una sola
 * actividad. Es el atajo que usan los endpoints del APU.
 */
export async function sincronizarPresupuestosDeActividad(
  tx: Prisma.TransactionClient,
  actividadId: string,
): Promise<string[]> {
  return sincronizarPresupuestosDeActividades(tx, [actividadId]);
}
