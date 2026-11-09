import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  recalcularCacheApu,
  sincronizarPresupuestosApu,
} from './apu-automatico.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateApusDto } from './dto/create-apus.dto.js';
import { UpdateApusDto } from './dto/update-apus.dto.js';

@Injectable()
export class ApusService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createApusDto: CreateApusDto) {
    const { actividadId, recursoId, cantidadPorUnidad } = createApusDto;

    await this.verificarActividadYRecurso(actividadId, recursoId);
    this.validarCantidadMinima(cantidadPorUnidad);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const detalle = await tx.apuDetalle.create({
          data: { actividadId, recursoId, cantidadPorUnidad },
          include: { recurso: true, actividad: true },
        });

        await this.recalcularCache(tx, actividadId);

        return detalle;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Este recurso ya forma parte del APU de esta actividad',
        );
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.apuDetalle.findMany({
      include: { recurso: true, actividad: true },
      orderBy: { actividad: { codigo: 'asc' } },
    });
  }

  async findOne(id: string) {
    const detalle = await this.prisma.apuDetalle.findUnique({
      where: { id },
      include: { recurso: true, actividad: true },
    });

    if (!detalle) {
      throw new NotFoundException(`Detalle de APU con ID ${id} no encontrado`);
    }

    return detalle;
  }

  /** Obtiene la receta completa de una actividad junto con su costo en caché. */
  async obtenerApuPorActividad(actividadId: string) {
    const actividad = await this.prisma.actividad.findUnique({
      where: { id: actividadId },
      include: {
        apuDetalles: {
          include: { recurso: true },
        },
        apuCostoCache: true,
      },
    });

    if (!actividad) {
      throw new NotFoundException(
        `Actividad con ID ${actividadId} no encontrada`,
      );
    }

    return actividad;
  }

  async update(id: string, updateApusDto: UpdateApusDto) {
    const actual = await this.findOne(id);
    const cantidad = updateApusDto.cantidadPorUnidad ?? actual.cantidadPorUnidad;
    this.validarCantidadMinima(
      new Prisma.Decimal(cantidad.toString()).toNumber(),
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const actualizado = await tx.apuDetalle.update({
          where: { id },
          data: updateApusDto,
          include: { recurso: true, actividad: true },
        });

        await this.recalcularCache(tx, actual.actividadId);

        return actualizado;
      });
    } catch (error) {
      throw error instanceof Error ? error : new Error('Error al actualizar APU');
    }
  }

  async remove(id: string) {
    const actual = await this.findOne(id);

    return await this.prisma.$transaction(async (tx) => {
      const eliminado = await tx.apuDetalle.delete({
        where: { id },
      });

      await this.recalcularCache(tx, actual.actividadId);

      return eliminado;
    });
  }

  private async verificarActividadYRecurso(
    actividadId: string,
    recursoId: string,
  ) {
    const [actividad, recurso] = await Promise.all([
      this.prisma.actividad.findUnique({ where: { id: actividadId } }),
      this.prisma.recurso.findUnique({ where: { id: recursoId } }),
    ]);

    if (!actividad) {
      throw new NotFoundException(
        `Actividad con ID ${actividadId} no encontrada`,
      );
    }
    if (!recurso) {
      throw new NotFoundException(`Recurso con ID ${recursoId} no encontrado`);
    }
    if (!recurso.activo) {
      throw new BadRequestException(
        `El recurso ${recurso.codigo} está inactivo y no se puede usar en un APU`,
      );
    }
  }

  private validarCantidadMinima(cantidad: number) {
    if (cantidad < 1) {
      throw new BadRequestException(
        'La cantidad por unidad de actividad debe ser como mínimo 1.',
      );
    }
  }

  private async recalcularCache(
    tx: Prisma.TransactionClient,
    actividadId: string,
  ) {
    const cache = await recalcularCacheApu(tx, actividadId);
    await sincronizarPresupuestosApu(tx, actividadId, cache);
  }

}
