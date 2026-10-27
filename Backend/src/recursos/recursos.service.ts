import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoRecurso } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CambiarPrecioDto } from './dto/cambiar-precio.dto.js';
import { CreateRecursoDto } from './dto/create-recurso.dto.js';
import { QueryHistorialDto } from './dto/query-historial.dto.js';
import { QueryRecursoDto } from './dto/query-recurso.dto.js';
import { UpdateRecursoDto } from './dto/update-recurso.dto.js';

@Injectable()
export class RecursosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Prefijo del código según el tipo de recurso (como en el Figma). */
  private readonly prefijos: Record<TipoRecurso, string> = {
    [TipoRecurso.material]: 'MAT',
    [TipoRecurso.mano_obra]: 'MO',
    [TipoRecurso.equipo]: 'EQ',
    [TipoRecurso.transporte]: 'TRA',
  };

  /**
   * Crea el recurso y registra su precio inicial en el historial.
   * Todo va en una transacción: o se guardan ambos, o ninguno.
   * Si no llega `codigo`, se genera automáticamente (MAT-0001, MO-0001...).
   */
  async create(createRecursoDto: CreateRecursoDto) {
    const { registradoPor, codigo, ...datos } = createRecursoDto;
    const maxIntentos = codigo ? 1 : 3;

    for (let intento = 0; intento < maxIntentos; intento++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const codigoFinal =
            codigo ?? (await this.generarCodigo(tx, datos.tipo));

          const recurso = await tx.recurso.create({
            data: { ...datos, codigo: codigoFinal },
          });

          await tx.historialPrecio.create({
            data: {
              recursoId: recurso.id,
              precio: datos.costoUnitario,
              fuente: datos.fuente ?? recurso.fuente,
              registradoPor: registradoPor ?? null,
            },
          });

          return recurso;
        });
      } catch (error) {
        // Si dos procesos piden el mismo código a la vez, reintentamos.
        if (
          !codigo &&
          this.esConflictoCodigo(error) &&
          intento < maxIntentos - 1
        ) {
          continue;
        }

        throw this.traducirErrorPrisma(error);
      }
    }

    throw new ConflictException(
      'No se pudo generar un código único para el recurso',
    );
  }

  findAll(query: QueryRecursoDto) {
    const where: Prisma.RecursoWhereInput = {};

    if (query.tipo) {
      where.tipo = query.tipo;
    }
    if (query.activo !== undefined) {
      where.activo = query.activo === 'true';
    }
    if (query.buscar) {
      where.OR = [
        { codigo: { contains: query.buscar, mode: 'insensitive' } },
        { descripcion: { contains: query.buscar, mode: 'insensitive' } },
        { nombreProveedor: { contains: query.buscar, mode: 'insensitive' } },
      ];
    }

    return this.prisma.recurso.findMany({
      where,
      orderBy: [{ tipo: 'asc' }, { codigo: 'asc' }],
    });
  }

  async findOne(id: string) {
    const recurso = await this.prisma.recurso.findUnique({ where: { id } });

    if (!recurso) {
      throw new NotFoundException(`Recurso con ID ${id} no encontrado`);
    }

    return recurso;
  }

  async update(id: string, updateRecursoDto: UpdateRecursoDto) {
    await this.findOne(id);

    try {
      return await this.prisma.recurso.update({
        where: { id },
        data: updateRecursoDto,
      });
    } catch (error) {
      throw this.traducirErrorPrisma(error);
    }
  }

  /** Borrado lógico: no rompe los APUs ni el historial que lo usan. */
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.recurso.update({
      where: { id },
      data: { activo: false },
    });
  }

  /**
   * Cambia el precio vigente EN UNA TRANSACCIÓN:
   *  1. inserta una fila nueva en historial_precios (nunca se sobrescribe),
   *  2. actualiza el precio y la fecha del recurso.
   *
   * TODO(paso 3): recalcular en cascada el ApuCostoCache de las actividades
   * que usan este recurso, dentro de esta misma transacción.
   */
  async cambiarPrecio(id: string, cambiarPrecioDto: CambiarPrecioDto) {
    const actual = await this.findOne(id);
    const dto = cambiarPrecioDto;

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.historialPrecio.create({
          data: {
            recursoId: id,
            precio: dto.precio,
            fuente: dto.fuente ?? actual.fuente,
            registradoPor: dto.registradoPor ?? null,
          },
        });

        return tx.recurso.update({
          where: { id },
          data: {
            costoUnitario: dto.precio,
            fechaActualizacion: new Date(),
            ...(dto.fuente !== undefined ? { fuente: dto.fuente } : {}),
            ...(dto.proveedor !== undefined
              ? { proveedor: dto.proveedor }
              : {}),
            ...(dto.nombreProveedor !== undefined
              ? { nombreProveedor: dto.nombreProveedor }
              : {}),
            ...(dto.urlProducto !== undefined
              ? { urlProducto: dto.urlProducto }
              : {}),
            ...(dto.imagenUrl !== undefined
              ? { imagenUrl: dto.imagenUrl }
              : {}),
          },
        });
      });
    } catch (error) {
      throw this.traducirErrorPrisma(error);
    }
  }

  async historial(id: string, query: QueryHistorialDto) {
    await this.findOne(id);

    return this.prisma.historialPrecio.findMany({
      where: {
        recursoId: id,
        ...(query.desde || query.hasta
          ? {
              fecha: {
                ...(query.desde ? { gte: new Date(query.desde) } : {}),
                ...(query.hasta ? { lte: new Date(query.hasta) } : {}),
              },
            }
          : {}),
      },
      orderBy: { fecha: 'desc' },
    });
  }

  /** Genera el siguiente código del tipo: MAT-0001, MO-0001, EQ-0001, TRA-0001. */
  private async generarCodigo(
    tx: Prisma.TransactionClient,
    tipo: TipoRecurso,
  ): Promise<string> {
    const prefijo = this.prefijos[tipo];
    const ultimo = await tx.recurso.findFirst({
      where: { codigo: { startsWith: `${prefijo}-` } },
      orderBy: { codigo: 'desc' },
      select: { codigo: true },
    });

    const ultimoNumero = ultimo
      ? Number.parseInt(ultimo.codigo.split('-')[1] ?? '0', 10)
      : 0;

    return `${prefijo}-${String(ultimoNumero + 1).padStart(4, '0')}`;
  }

  private esConflictoCodigo(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      (error.meta.target as string[]).includes('codigo')
    );
  }

  /** Convierte errores de Prisma en errores HTTP en español. */
  private traducirErrorPrisma(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const campos = Array.isArray(error.meta?.target)
          ? (error.meta.target as string[]).join(', ')
          : 'código o proveedor/url';
        return new ConflictException(
          `Ya existe un recurso con el mismo ${campos}`,
        );
      }

      if (error.code === 'P2025') {
        return new NotFoundException('Recurso no encontrado');
      }
    }

    return error instanceof Error ? error : new Error('Error inesperado');
  }
}
