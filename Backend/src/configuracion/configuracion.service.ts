import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
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

  actualizar(dto: UpdateConfiguracionDto) {
    const datos = {
      ...dto,
      // Normalizamos la moneda a mayúsculas (nio -> NIO).
      ...(dto.moneda ? { moneda: dto.moneda.toUpperCase() } : {}),
    };

    return this.prisma.configuracion.upsert({
      where: { id: ID_CONFIGURACION },
      update: datos,
      create: { id: ID_CONFIGURACION, ...datos },
    });
  }
}
