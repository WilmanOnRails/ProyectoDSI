import { Injectable } from '@nestjs/common';
import { Configuracion } from '@prisma/client';
import {
  calcularResumenPresupuesto,
  calcularTotalesLinea,
} from '../calculos/calculos.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateConfiguracionDto } from './dto/update-configuracion.dto.js';

/**
 * La configuración es un registro único (singleton): siempre se usa el id 1.
 * Los porcentajes de este módulo son la ÚNICA fuente para calcular el resumen
 * de los presupuestos. Al guardarlos, se recalculan todos los presupuestos.
 */
const ID_CONFIGURACION = 1;

@Injectable()
export class ConfiguracionService {
  constructor(private readonly prisma: PrismaService) {}

  obtener() {
    return this.prisma.configuracion.upsert({
      where: { id: ID_CONFIGURACION },
      update: {},
      create: { id: ID_CONFIGURACION },
    });
  }

  async actualizar(dto: UpdateConfiguracionDto) {
    const datos = {
      ...dto,
      // Normalizamos la moneda a mayúsculas (nio -> NIO).
      ...(dto.moneda ? { moneda: dto.moneda.toUpperCase() } : {}),
    };

    const config = await this.prisma.configuracion.upsert({
      where: { id: ID_CONFIGURACION },
      update: datos,
      create: { id: ID_CONFIGURACION, ...datos },
    });

    // Si cambió cualquier porcentaje, todos los presupuestos deben reflejarlo.
    await this.recalcularPresupuestos(config);

    return config;
  }

  /**
   * Recalcula todos los presupuestos con la MISMA función pura que usa el
   * módulo de Presupuestos. Así la pantalla, el Excel y la base de datos
   * siempre muestran el mismo resultado.
   */
  private async recalcularPresupuestos(config: Configuracion) {
    const porcentajes = {
      pctIndirectos: config.pctIndirectosDef,
      pctAdministracion: config.pctAdministracionDef,
      pctUtilidad: config.pctUtilidadDef,
      pctImprevistos: config.pctImprevistosDef,
      pctImpuestos: config.pctImpuestosDef,
    };

    const presupuestos = await this.prisma.presupuesto.findMany({
      include: { items: true },
    });

    for (const presupuesto of presupuestos) {
      await this.prisma.$transaction(async (tx) => {
        for (const item of presupuesto.items) {
          const linea = calcularTotalesLinea(item);
          if (!item.total.equals(linea.sumaTotal)) {
            await tx.presupuestoItem.update({
              where: { id: item.id },
              data: { total: linea.sumaTotal },
            });
          }
        }

        const resumen = calcularResumenPresupuesto(
          presupuesto.items,
          porcentajes,
        );

        await tx.presupuesto.update({
          where: { id: presupuesto.id },
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
      });
    }
  }
}
