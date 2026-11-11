import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoRecurso } from '@prisma/client';
import {
  recalcularCacheApu,
  sincronizarPresupuestosApu,
} from './apu-automatico.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateApusDto } from './dto/create-apus.dto.js';
import { UpdateApusDto } from './dto/update-apus.dto.js';

const APU_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

@Injectable()
export class ApusService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createApusDto: CreateApusDto) {
    const { actividadId, recursoId, cantidadPorUnidad } = createApusDto;

    await this.verificarActividadYRecurso(actividadId, recursoId);
    this.validarCantidadMinima(cantidadPorUnidad);

    return this.prisma.$transaction(
      async (tx) => {
        const recurso = await tx.recurso.findUniqueOrThrow({
          where: { id: recursoId },
          select: { tipo: true },
        });
        const detalleExistente =
          recurso.tipo === TipoRecurso.material
            ? await tx.apuDetalle.findFirst({
                where: { actividadId, recursoId },
              })
            : null;
        const detalle = detalleExistente
          ? await tx.apuDetalle.update({
              where: { id: detalleExistente.id },
              data: {
                cantidadPorUnidad: { increment: cantidadPorUnidad },
              },
              include: { recurso: true, actividad: true },
            })
          : await tx.apuDetalle.create({
              data: { actividadId, recursoId, cantidadPorUnidad },
              include: { recurso: true, actividad: true },
            });

        await this.recalcularCache(tx, actividadId);

        return detalle;
      },
      APU_TRANSACTION_OPTIONS,
    );
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
      return await this.prisma.$transaction(
        async (tx) => {
          const actualizado = await tx.apuDetalle.update({
            where: { id },
            data: updateApusDto,
            include: { recurso: true, actividad: true },
          });

          await this.recalcularCache(tx, actual.actividadId);

          return actualizado;
        },
        APU_TRANSACTION_OPTIONS,
      );
    } catch (error) {
      throw error instanceof Error ? error : new Error('Error al actualizar APU');
    }
  }

  async remove(id: string) {
    const actual = await this.findOne(id);

    return await this.prisma.$transaction(
      async (tx) => {
        const eliminado = await tx.apuDetalle.delete({
          where: { id },
        });

        await this.recalcularCache(tx, actual.actividadId);

        return eliminado;
      },
      APU_TRANSACTION_OPTIONS,
    );
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
