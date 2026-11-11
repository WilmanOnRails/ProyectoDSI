import { Prisma, TipoRecurso } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  construirApuAutomatico,
  type RecursoApuAutomatico,
} from './apu-automatico.js';

const recursos: RecursoApuAutomatico[] = [
  {
    id: 'ayudante',
    tipo: TipoRecurso.mano_obra,
    descripcion: 'Ayudante de obra',
    costoUnitario: new Prisma.Decimal('62.50'),
  },
  {
    id: 'topografo',
    tipo: TipoRecurso.mano_obra,
    descripcion: 'Topógrafo',
    costoUnitario: new Prisma.Decimal('100.00'),
  },
  {
    id: 'dibujante',
    tipo: TipoRecurso.mano_obra,
    descripcion: 'Dibujante técnico',
    costoUnitario: new Prisma.Decimal('100.00'),
  },
  {
    id: 'oficial',
    tipo: TipoRecurso.mano_obra,
    descripcion: 'Oficial albañil',
    costoUnitario: new Prisma.Decimal('120.00'),
  },
  {
    id: 'camion',
    tipo: TipoRecurso.equipo,
    descripcion: 'Camión de 2 toneladas',
    costoUnitario: new Prisma.Decimal('200.00'),
  },
  {
    id: 'herramientas',
    tipo: TipoRecurso.equipo,
    descripcion: 'Herramientas menores',
    costoUnitario: new Prisma.Decimal('80.00'),
  },
  {
    id: 'equipo-topografia',
    tipo: TipoRecurso.equipo,
    descripcion: 'Equipo de topografía',
    costoUnitario: new Prisma.Decimal('250.00'),
  },
  {
    id: 'estacion-total',
    tipo: TipoRecurso.equipo,
    descripcion: 'Estación total',
    costoUnitario: new Prisma.Decimal('250.00'),
  },
  {
    id: 'retro',
    tipo: TipoRecurso.equipo,
    descripcion: 'Retroexcavadora (referencia Excel)',
    costoUnitario: new Prisma.Decimal('1464.97'),
  },
  {
    id: 'volqueta',
    tipo: TipoRecurso.transporte,
    descripcion: 'Camión de volteo (Volqueta)',
    costoUnitario: new Prisma.Decimal('1500.00'),
  },
  {
    id: 'cisterna',
    tipo: TipoRecurso.equipo,
    descripcion: 'Camión cisterna',
    costoUnitario: new Prisma.Decimal('572.26'),
  },
  {
    id: 'motoniveladora',
    tipo: TipoRecurso.equipo,
    descripcion: 'Motoniveladora',
    costoUnitario: new Prisma.Decimal('2746.82'),
  },
  {
    id: 'compactador-excel',
    tipo: TipoRecurso.equipo,
    descripcion: 'Compactador',
    costoUnitario: new Prisma.Decimal('2014.34'),
  },
  {
    id: 'operador-cisterna',
    tipo: TipoRecurso.mano_obra,
    descripcion: 'Operador de camión cisterna',
    costoUnitario: new Prisma.Decimal('62.50'),
  },
  {
    id: 'operador-motoniveladora',
    tipo: TipoRecurso.mano_obra,
    descripcion: 'Operador de motoniveladora',
    costoUnitario: new Prisma.Decimal('62.50'),
  },
  {
    id: 'operador-compactador',
    tipo: TipoRecurso.mano_obra,
    descripcion: 'Operador de compactador',
    costoUnitario: new Prisma.Decimal('62.50'),
  },
  {
    id: 'operador-retro',
    tipo: TipoRecurso.mano_obra,
    descripcion: 'Operador de retroexcavadora',
    costoUnitario: new Prisma.Decimal('62.50'),
  },
  {
    id: 'agua',
    tipo: TipoRecurso.material,
    descripcion: 'Agua',
    costoUnitario: new Prisma.Decimal('0.90'),
  },
  {
    id: 'madera',
    tipo: TipoRecurso.material,
    descripcion: 'Madera de pino',
    costoUnitario: new Prisma.Decimal('15.00'),
  },
];

describe('construirApuAutomatico', () => {
  it('aplica un mínimo de una HH o HM por unidad aunque cambie la cantidad del proyecto', () => {
    const resultado = construirApuAutomatico(
      'Limpieza inicial.',
      'm2',
      recursos,
      '3710.36',
    );
    const resultadoUnaUnidad = construirApuAutomatico(
      'Limpieza inicial.',
      'm2',
      recursos,
      1,
    );

    expect(resultado.metodo).toBe('referencia');
    expect(
      resultado.detalles.find((detalle) => detalle.recursoId === 'ayudante')
        ?.cantidadPorUnidad.toString(),
    ).toBe('1');
    expect(
      resultadoUnaUnidad.detalles.find((detalle) => detalle.recursoId === 'ayudante')
        ?.cantidadPorUnidad.toString(),
    ).toBe('1');
    expect(
      resultado.detalles.find((detalle) => detalle.recursoId === 'camion')
        ?.cantidadPorUnidad.toString(),
    ).toBe('1');
    expect(
      resultadoUnaUnidad.detalles.find((detalle) => detalle.recursoId === 'camion')
        ?.cantidadPorUnidad.toString(),
    ).toBe('1');
  });

  it('eleva a uno o más las cantidades de materiales por unidad de actividad', () => {
    const resultado = construirApuAutomatico(
      'Trazo y nivelacion',
      'm2',
      recursos,
      1,
    );

    expect(
      resultado.detalles.find((detalle) => detalle.recursoId === 'madera')
        ?.cantidadPorUnidad.toString(),
    ).toBe('1');
  });

  it('crea una receta aproximada y editable para una actividad no referenciada', () => {
    const resultado = construirApuAutomatico(
      'Demolición de elementos de concreto',
      'm2',
      recursos,
      100,
    );

    expect(resultado.metodo).toBe('aproximado');
    expect(resultado.referencia).toContain('Rendimiento aproximado');
    expect(
      resultado.detalles.some((detalle) => detalle.recursoId === 'oficial'),
    ).toBe(true);
    expect(
      resultado.detalles.some((detalle) => detalle.recursoId === 'retro'),
    ).toBe(true);
    expect(
      resultado.detalles.find((detalle) => detalle.recursoId === 'ayudante')
        ?.cantidadPorUnidad.toString(),
    ).toBe('1');
  });

  it('incluye transporte para actividades estimadas con desalojo', () => {
    const resultado = construirApuAutomatico(
      'Desalojo de material sobrante',
      'm3',
      recursos,
      100,
    );

    expect(
      resultado.detalles.find((detalle) => detalle.recursoId === 'volqueta')
        ?.cantidadPorUnidad.toString(),
    ).toBe('1');
  });

  it('conserva rendimientos mayores a uno cuando la actividad los necesita', () => {
    const resultado = construirApuAutomatico(
      'Topografía',
      'km',
      recursos,
      3710.36,
    );

    expect(
      resultado.detalles.find((detalle) => detalle.recursoId === 'topografo')
        ?.cantidadPorUnidad.toString(),
    ).toBe('8');
  });

  it('usa la receta de relleno aunque la descripción mencione material selecto', () => {
    const resultado = construirApuAutomatico(
      'Relleno, conformación y compactación de material selecto de banco de préstamo',
      'm3',
      recursos,
    );

    expect(resultado.metodo).toBe('referencia');
    expect(
      resultado.detalles.find((detalle) => detalle.recursoId === 'agua')
        ?.cantidadPorUnidad.toString(),
    ).toBe('8.1136');
  });
});
