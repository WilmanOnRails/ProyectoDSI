import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TipoRecurso } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { calcularApu } from '../calculos/calculos.js';
import { CambiarPrecioDto } from './dto/cambiar-precio.dto.js';
import { CreateRecursoDto } from './dto/create-recurso.dto.js';
import {
  ImportarRecursoDto,
  ImportarRecursosDto,
} from './dto/importar-recursos.dto.js';
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
   *  2. actualiza el precio y la fecha del recurso,
   *  3. recalcula en cascada el ApuCostoCache de todas las actividades que usan este recurso.
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

        const recursoActualizado = await tx.recurso.update({
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

        // -----------------------------------------------------------------
        // Recálculo en cascada del APU para todas las actividades afectadas
        // -----------------------------------------------------------------
        const detallesAfectados = await tx.apuDetalle.findMany({
          where: { recursoId: id },
          select: { actividadId: true },
        });

        const idsActividades = [
          ...new Set(detallesAfectados.map((d) => d.actividadId)),
        ];

        for (const actividadId of idsActividades) {
          // Traer TODOS los detalles de la receta de esta actividad
          const receta = await tx.apuDetalle.findMany({
            where: { actividadId },
            include: { recurso: { select: { costoUnitario: true } } },
          });

          // Armar el mapa de precios actuales
          const preciosMapa: Record<string, Prisma.Decimal> = {};
          const detallesParaCalculo = receta.map((det) => {
            preciosMapa[det.recursoId] = det.recurso.costoUnitario;
            return {
              recursoId: det.recursoId,
              tipo: det.recursoId === id ? 'tipo_determinado' : 'material', // se resolverá bien con el tipo del recurso si lo incluimos
              cantidadPorUnidad: det.cantidadPorUnidad,
            };
          });

          // Necesitamos también el tipo del recurso en cada detalle
          const recetaCompleta = await tx.apuDetalle.findMany({
            where: { actividadId },
            include: {
              recurso: { select: { id: true, tipo: true, costoUnitario: true } },
            },
          });

          const preciosMap: Record<string, Prisma.Decimal> = {};
          const detallesCalculo = recetaCompleta.map((det) => {
            preciosMap[det.recursoId] = det.recurso.costoUnitario;
            return {
              recursoId: det.recursoId,
              tipo: det.recurso.tipo,
              cantidadPorUnidad: det.cantidadPorUnidad,
            };
          });

          const costoCalculado = calcularApu(detallesCalculo, preciosMap);

          await tx.apuCostoCache.upsert({
            where: { actividadId },
            update: {
              costoMateriales: costoCalculado.costoMateriales,
              costoManoObra: costoCalculado.costoManoObra,
              costoEquipo: costoCalculado.costoEquipo,
              costoTransporte: costoCalculado.costoTransporte,
              costoTotal: costoCalculado.costoTotal,
              fechaCalculo: new Date(),
            },
            create: {
              actividadId,
              costoMateriales: costoCalculado.costoMateriales,
              costoManoObra: costoCalculado.costoManoObra,
              costoEquipo: costoCalculado.costoEquipo,
              costoTransporte: costoCalculado.costoTransporte,
              costoTotal: costoCalculado.costoTotal,
              fechaCalculo: new Date(),
            },
          });
        }

        return recursoActualizado;
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

  /**
   * Importa productos del scraping de forma idempotente.
   * La llave es proveedor + urlProducto:
   *  - si no existe, lo crea (con código automático y precio inicial),
   *  - si existe y cambió el precio, agrega historial y actualiza el vigente,
   *  - si existe y el precio es igual, solo refresca metadatos.
   */
  async importar(importarRecursosDto: ImportarRecursosDto) {
    const resultado = {
      total: importarRecursosDto.recursos.length,
      creados: 0,
      actualizados: 0,
      sinCambios: 0,
      errores: [] as Array<{ urlProducto: string; mensaje: string }>,
    };

    for (const item of importarRecursosDto.recursos) {
      try {
        const existente = await this.prisma.recurso.findUnique({
          where: {
            proveedor_urlProducto: {
              proveedor: item.proveedor,
              urlProducto: item.urlProducto,
            },
          },
        });

        if (!existente) {
          await this.create({
            tipo: item.tipo ?? TipoRecurso.material,
            categoria: item.categoria,
            descripcion: item.descripcion,
            unidad: item.unidad ?? 'Unidad',
            costoUnitario: item.precio,
            fuente: item.fuente ?? item.proveedor,
            proveedor: item.proveedor,
            nombreProveedor: item.nombreProveedor ?? item.descripcion,
            urlProducto: item.urlProducto,
            imagenUrl: item.imagenUrl,
            registradoPor: item.registradoPor,
          });
          resultado.creados++;
          continue;
        }

        if (!existente.costoUnitario.equals(item.precio)) {
          await this.cambiarPrecio(existente.id, {
            precio: item.precio,
            fuente: item.fuente ?? item.proveedor,
            registradoPor: item.registradoPor,
            proveedor: item.proveedor,
            nombreProveedor: item.nombreProveedor ?? item.descripcion,
            urlProducto: item.urlProducto,
            imagenUrl: item.imagenUrl,
          });
          await this.actualizarMetadatos(existente.id, item);
          resultado.actualizados++;
        } else {
          await this.actualizarMetadatos(existente.id, item);
          resultado.sinCambios++;
        }
      } catch (error) {
        resultado.errores.push({
          urlProducto: item.urlProducto,
          mensaje: error instanceof Error ? error.message : 'Error inesperado',
        });
      }
    }

    return resultado;
  }

  private actualizarMetadatos(id: string, item: ImportarRecursoDto) {
    return this.prisma.recurso.update({
      where: { id },
      data: {
        descripcion: item.descripcion,
        ...(item.categoria !== undefined ? { categoria: item.categoria } : {}),
        ...(item.unidad !== undefined ? { unidad: item.unidad } : {}),
        ...(item.nombreProveedor !== undefined
          ? { nombreProveedor: item.nombreProveedor }
          : {}),
        ...(item.imagenUrl !== undefined ? { imagenUrl: item.imagenUrl } : {}),
      },
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
