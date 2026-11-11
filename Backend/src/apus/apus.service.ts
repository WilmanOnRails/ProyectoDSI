import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoRecurso } from '@prisma/client';
import {
  crearApuAutomaticoEnTransaccion,
  recalcularCacheApu,
} from './apu-automatico.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateApusDto } from './dto/create-apus.dto.js';
import { UpdateApusDto } from './dto/update-apus.dto.js';

const APU_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };
const APU_SNAPSHOT_SELECT = {
  id: true,
  codigo: true,
  nombre: true,
  unidad: true,
  capituloCodigo: true,
  capituloNombre: true,
  apuDetalles: {
    select: {
      id: true,
      recursoId: true,
      cantidadPorUnidad: true,
      recurso: {
        select: {
          id: true,
          codigo: true,
          tipo: true,
          categoria: true,
          descripcion: true,
          unidad: true,
          costoUnitario: true,
        },
      },
    },
  },
  apuCostoCache: {
    select: {
      costoMateriales: true,
      costoManoObra: true,
      costoEquipo: true,
      costoTransporte: true,
      costoTotal: true,
    },
  },
} satisfies Prisma.ActividadSelect;
const APU_RESOURCE_SELECT = {
  id: true,
  codigo: true,
  tipo: true,
  categoria: true,
  descripcion: true,
  unidad: true,
  costoUnitario: true,
} satisfies Prisma.RecursoSelect;

@Injectable()
export class ApusService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createApusDto: CreateApusDto) {
    const { actividadId, recursoId, cantidadPorUnidad } = createApusDto;

    this.validarCantidadMinima(cantidadPorUnidad);

    return this.prisma.$transaction(
      async (tx) => {
        const [actividad, recurso] = await Promise.all([
          tx.actividad.findUnique({
            where: { id: actividadId },
            select: { id: true },
          }),
          tx.recurso.findUnique({
            where: { id: recursoId },
            select: { id: true, tipo: true, activo: true, codigo: true },
          }),
        ]);
        if (!actividad) {
          throw new NotFoundException(
            `Actividad con ID ${actividadId} no encontrada`,
          );
        }
        if (!recurso) {
          throw new NotFoundException(
            `Recurso con ID ${recursoId} no encontrado`,
          );
        }
        if (!recurso.activo) {
          throw new BadRequestException(
            `El recurso ${recurso.codigo} está inactivo y no se puede usar en un APU`,
          );
        }
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
              include: { recurso: { select: APU_RESOURCE_SELECT } },
            })
            : await tx.apuDetalle.create({
                data: { actividadId, recursoId, cantidadPorUnidad },
                include: { recurso: { select: APU_RESOURCE_SELECT } },
              });

        const apuCostoCache = await recalcularCacheApu(tx, actividadId);

        return { ...detalle, apuCostoCache };
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
    let actividad = await this.prisma.actividad.findUnique({
      where: { id: actividadId },
      select: APU_SNAPSHOT_SELECT,
    });

    if (!actividad) {
      throw new NotFoundException(
        `Actividad con ID ${actividadId} no encontrada`,
      );
    }

    if (actividad.apuDetalles.length === 0) {
      await this.generarApuSiHaceFalta(actividadId);
      actividad = await this.prisma.actividad.findUnique({
        where: { id: actividadId },
        select: APU_SNAPSHOT_SELECT,
      });
    }

    return actividad;
  }

  private async generarApuSiHaceFalta(actividadId: string) {
    await this.prisma.$transaction(
      async (tx) => {
        const actividad = await tx.actividad.findUnique({
          where: { id: actividadId },
          select: {
            id: true,
            nombre: true,
            unidad: true,
            apuDetalles: { select: { id: true }, take: 1 },
            presupuestoItems: {
              orderBy: { orden: 'asc' },
              take: 1,
              select: { cantidadProyecto: true },
            },
          },
        });

        if (!actividad) {
          throw new NotFoundException(
            `Actividad con ID ${actividadId} no encontrada`,
          );
        }
        if (actividad.apuDetalles.length > 0) return;

        const recursos = await tx.recurso.findMany({
          where: { activo: true },
          select: {
            id: true,
            tipo: true,
            descripcion: true,
            costoUnitario: true,
          },
        });
        await crearApuAutomaticoEnTransaccion(
          tx,
          actividad,
          recursos,
          actividad.presupuestoItems[0]?.cantidadProyecto ?? 1,
        );
      },
      { timeout: 30000, maxWait: 10000 },
    );
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
            include: { recurso: { select: APU_RESOURCE_SELECT } },
          });

          const apuCostoCache = await recalcularCacheApu(
            tx,
            actual.actividadId,
          );

          return { ...actualizado, apuCostoCache };
        },
        APU_TRANSACTION_OPTIONS,
      );
    } catch (error) {
      throw error instanceof Error ? error : new Error('Error al actualizar APU');
    }
  }

  async remove(id: string) {
    const actual = await this.findOne(id);

    return this.prisma.$transaction(
      async (tx) => {
        const eliminado = await tx.apuDetalle.delete({
          where: { id },
        });

        const apuCostoCache = await recalcularCacheApu(
          tx,
          actual.actividadId,
        );

        return { ...eliminado, apuCostoCache };
      },
      APU_TRANSACTION_OPTIONS,
    );
  }

  private validarCantidadMinima(cantidad: number) {
    if (cantidad < 1) {
      throw new BadRequestException(
        'La cantidad por unidad de actividad debe ser como mínimo 1.',
      );
    }
  }

}
