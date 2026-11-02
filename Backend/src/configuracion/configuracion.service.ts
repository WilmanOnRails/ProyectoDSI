import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { calcularTotalesPresupuesto } from '../calculos/calculos.js';
import { UpdateConfiguracionDto } from './dto/update-configuracion.dto.js';

/**
 * La configuración es un registro único (singleton): siempre se usa el id 1.
 * Así la pantalla "Configuración" no necesita crear nada manualmente.
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

    // Si se actualizaron porcentajes por defecto, propagarlos a los presupuestos existentes
    if (
      dto.pctIndirectosDef !== undefined ||
      dto.pctUtilidadDef !== undefined ||
      dto.pctImpuestosDef !== undefined
    ) {
      const presupuestos = await this.prisma.presupuesto.findMany({
        include: { items: true },
      });

      for (const p of presupuestos) {
        const pIndirectos = dto.pctIndirectosDef ?? p.pctIndirectos;
        const pUtilidad = dto.pctUtilidadDef ?? p.pctUtilidad;
        const pImpuestos = dto.pctImpuestosDef ?? p.pctImpuestos;

        let dirTot = new Prisma.Decimal(0);
        let dirMat = new Prisma.Decimal(0);
        let dirMo = new Prisma.Decimal(0);
        let dirEq = new Prisma.Decimal(0);
        let dirTr = new Prisma.Decimal(0);

        for (const item of p.items) {
          const cant = item.cantidadProyecto;
          dirMat = dirMat.add(item.costoMaterialesCong.mul(cant));
          dirMo = dirMo.add(item.costoManoObraCong.mul(cant));
          dirEq = dirEq.add(item.costoEquipoCong.mul(cant));
          dirTr = dirTr.add(item.costoTransporteCong.mul(cant));
          dirTot = dirTot.add(item.total);
        }

        const calc = calcularTotalesPresupuesto(dirTot, {
          pctIndirectos: pIndirectos,
          pctUtilidad: pUtilidad,
          pctImpuestos: pImpuestos,
          pctImprevistos: p.pctImprevistos,
        });

        await this.prisma.presupuesto.update({
          where: { id: p.id },
          data: {
            pctIndirectos: pIndirectos,
            pctUtilidad: pUtilidad,
            pctImpuestos: pImpuestos,
            costosDirectos: calc.costosDirectos,
            indirectos: calc.indirectos,
            utilidad: calc.utilidad,
            imprevistos: calc.imprevistos,
            subtotalNeto: calc.subtotalNeto,
            impuestos: calc.impuestos,
            total: calc.total,
          },
        });
      }
    }

    return config;
  }
}
