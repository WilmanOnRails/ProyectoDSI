import { InternalServerErrorException } from '@nestjs/common';
import { Prisma, TipoRecurso } from '@prisma/client';
import {
  calcularApu,
  calcularResumenPresupuesto,
  calcularTotalesLinea,
} from '../calculos/calculos.js';

export interface RecursoApuAutomatico {
  id: string;
  tipo: TipoRecurso;
  descripcion: string;
  costoUnitario: Prisma.Decimal;
}

interface LineaBase {
  tipo: TipoRecurso;
  descripcion: string;
  cantidad: string;
}

interface RecetaBase {
  nombre: string;
  cantidadBase: string;
  lineas: LineaBase[];
}

export interface DetalleApuAutomatico {
  recursoId: string;
  tipo: TipoRecurso;
  cantidadPorUnidad: Prisma.Decimal;
}

export interface ResultadoApuAutomatico {
  metodo: 'referencia' | 'aproximado';
  referencia: string;
  detalles: DetalleApuAutomatico[];
}

const recurso = {
  ayudante: {
    tipo: TipoRecurso.mano_obra,
    descripcion: 'Ayudante de obra',
  },
  topografo: { tipo: TipoRecurso.mano_obra, descripcion: 'Topógrafo' },
  dibujante: { tipo: TipoRecurso.mano_obra, descripcion: 'Dibujante técnico' },
  operadorCisterna: {
    tipo: TipoRecurso.mano_obra,
    descripcion: 'Operador de camión cisterna',
  },
  operadorMotoniveladora: {
    tipo: TipoRecurso.mano_obra,
    descripcion: 'Operador de motoniveladora',
  },
  operadorCompactador: {
    tipo: TipoRecurso.mano_obra,
    descripcion: 'Operador de compactador',
  },
  operadorRetroexcavadora: {
    tipo: TipoRecurso.mano_obra,
    descripcion: 'Operador de retroexcavadora',
  },
  operadorVolquete: {
    tipo: TipoRecurso.mano_obra,
    descripcion: 'Operador de camión volquete',
  },
  camionDosToneladas: {
    tipo: TipoRecurso.equipo,
    descripcion: 'Camión de 2 toneladas',
  },
  herramientas: {
    tipo: TipoRecurso.equipo,
    descripcion: 'Herramientas menores',
  },
  estacionTotal: { tipo: TipoRecurso.equipo, descripcion: 'Estación total' },
  equipoTopografico: {
    tipo: TipoRecurso.equipo,
    descripcion: 'Equipo de topografía',
  },
  tractor: { tipo: TipoRecurso.equipo, descripcion: 'Tractor D-6' },
  retroexcavadora: {
    tipo: TipoRecurso.equipo,
    descripcion: 'Retroexcavadora de movimiento de tierra',
  },
  volquete: {
    tipo: TipoRecurso.equipo,
    descripcion: 'Volquete para desalojo',
  },
  cisterna: { tipo: TipoRecurso.equipo, descripcion: 'Camión cisterna' },
  motoniveladora: {
    tipo: TipoRecurso.equipo,
    descripcion: 'Motoniveladora',
  },
  compactador: {
    tipo: TipoRecurso.equipo,
    descripcion: 'Compactador',
  },
  camionMaterialSelecto: {
    tipo: TipoRecurso.equipo,
    descripcion: 'Camión volquete para material selecto',
  },
  lowboyTractor: {
    tipo: TipoRecurso.transporte,
    descripcion: 'Traslado Lowboy - Tractor D-6',
  },
  lowboyRetroexcavadora: {
    tipo: TipoRecurso.transporte,
    descripcion: 'Traslado Lowboy - Retroexcavadora',
  },
  lowboyCompactador: {
    tipo: TipoRecurso.transporte,
    descripcion: 'Traslado Lowboy - Compactador',
  },
  lowboyMotoniveladora: {
    tipo: TipoRecurso.transporte,
    descripcion: 'Traslado Lowboy - Motoniveladora',
  },
  agua: { tipo: TipoRecurso.material, descripcion: 'Agua' },
  madera: { tipo: TipoRecurso.material, descripcion: 'Madera de pino' },
  materialSelecto: {
    tipo: TipoRecurso.material,
    descripcion: 'Material selecto',
  },
  oficial: {
    tipo: TipoRecurso.mano_obra,
    descripcion: 'Oficial albañil',
  },
  volquetaTransporte: {
    tipo: TipoRecurso.transporte,
    descripcion: 'Camión de volteo (Volqueta)',
  },
} satisfies Record<string, { tipo: TipoRecurso; descripcion: string }>;

const recetasReferencia: Array<{ patron: RegExp; receta: RecetaBase }> = [
  {
    patron: /\blimpieza inicial\b/,
    receta: {
      nombre: 'Limpieza inicial',
      cantidadBase: '10000',
      lineas: [
        { ...recurso.ayudante, cantidad: '144' },
        { ...recurso.camionDosToneladas, cantidad: '16' },
        { ...recurso.herramientas, cantidad: '16' },
      ],
    },
  },
  {
    patron: /\btrazo y nivelacion\b/,
    receta: {
      nombre: 'Trazo y nivelación',
      cantidadBase: '10000',
      lineas: [
        { ...recurso.estacionTotal, cantidad: '2' },
        { ...recurso.camionDosToneladas, cantidad: '6' },
        { ...recurso.ayudante, cantidad: '48' },
        { ...recurso.topografo, cantidad: '16' },
        { ...recurso.dibujante, cantidad: '1' },
        { ...recurso.madera, cantidad: '100' },
      ],
    },
  },
  {
    patron: /\btopografia\b/,
    receta: {
      nombre: 'Topografía',
      cantidadBase: '6',
      lineas: [
        { ...recurso.equipoTopografico, cantidad: '2' },
        { ...recurso.camionDosToneladas, cantidad: '6' },
        { ...recurso.ayudante, cantidad: '32' },
        { ...recurso.topografo, cantidad: '48' },
        { ...recurso.madera, cantidad: '250' },
      ],
    },
  },
  {
    patron: /\bmovilizacion y desmovilizacion de equipos\b/,
    receta: {
      nombre: 'Movilización y desmovilización de equipos',
      cantidadBase: '2',
      lineas: [
        { ...recurso.lowboyTractor, cantidad: '1' },
        { ...recurso.lowboyRetroexcavadora, cantidad: '1' },
        { ...recurso.lowboyCompactador, cantidad: '1' },
        { ...recurso.lowboyMotoniveladora, cantidad: '1' },
      ],
    },
  },
  {
    patron: /\bcorte de terreno con equipo\b/,
    receta: {
      nombre: 'Corte de terreno con equipo',
      cantidadBase: '2588.25',
      lineas: [
        { ...recurso.tractor, cantidad: '20' },
        { ...recurso.retroexcavadora, cantidad: '20' },
        { ...recurso.ayudante, cantidad: '128' },
      ],
    },
  },
  {
    patron: /\bdesalojo de material de corte\b/,
    receta: {
      nombre: 'Desalojo de material de corte',
      cantidadBase: '3364.74',
      lineas: [
        { ...recurso.volquete, cantidad: '70.2' },
        { ...recurso.retroexcavadora, cantidad: '42.12' },
        { ...recurso.ayudante, cantidad: '96' },
      ],
    },
  },
  {
    patron: /\bconformacion y compactacion de terreno\b/,
    receta: {
      nombre: 'Conformación y compactación de terreno',
      cantidadBase: '10000',
      lineas: [
        { ...recurso.cisterna, cantidad: '8' },
        { ...recurso.motoniveladora, cantidad: '12' },
        { ...recurso.compactador, cantidad: '24' },
        { ...recurso.ayudante, cantidad: '24' },
        { ...recurso.operadorCisterna, cantidad: '8' },
        { ...recurso.operadorMotoniveladora, cantidad: '12' },
        { ...recurso.operadorCompactador, cantidad: '24' },
        { ...recurso.agua, cantidad: '3250' },
      ],
    },
  },
  {
    patron: /\b(suministro de material selecto|instalar material selecto|selecto para base)\b/,
    receta: {
      nombre: 'Suministro de material selecto para base',
      cantidadBase: '1922.7',
      lineas: [
        { ...recurso.camionMaterialSelecto, cantidad: '161' },
        { ...recurso.operadorVolquete, cantidad: '161' },
        { ...recurso.materialSelecto, cantidad: '2499.51' },
      ],
    },
  },
  {
    patron: /\brelleno\b.*\bcompactacion\b/,
    receta: {
      nombre: 'Relleno, conformación y compactación',
      cantidadBase: '1479',
      lineas: [
        { ...recurso.cisterna, cantidad: '32' },
        { ...recurso.motoniveladora, cantidad: '20' },
        { ...recurso.compactador, cantidad: '20' },
        { ...recurso.retroexcavadora, cantidad: '24' },
        { ...recurso.ayudante, cantidad: '96' },
        { ...recurso.operadorCisterna, cantidad: '32' },
        { ...recurso.operadorMotoniveladora, cantidad: '20' },
        { ...recurso.operadorCompactador, cantidad: '20' },
        { ...recurso.operadorRetroexcavadora, cantidad: '24' },
        { ...recurso.agua, cantidad: '12000' },
        { ...recurso.madera, cantidad: '300' },
      ],
    },
  },
  {
    patron: /\blimpieza final\b/,
    receta: {
      nombre: 'Limpieza final y entrega',
      cantidadBase: '10000',
      lineas: [
        { ...recurso.camionDosToneladas, cantidad: '8' },
        { ...recurso.retroexcavadora, cantidad: '6' },
        { ...recurso.ayudante, cantidad: '64' },
      ],
    },
  },
];

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function cantidadPorUnidad(total: string, base: string): Prisma.Decimal {
  return new Prisma.Decimal(total).div(base).toDecimalPlaces(4);
}

function cantidadAproximada(unidad: string): {
  ayudante: string;
  oficial: string;
  herramienta: string;
  maquina: string;
  transporte: string;
} {
  const unidadNormalizada = normalizar(unidad);
  if (unidadNormalizada === 'm2' || unidadNormalizada === 'm²') {
    return {
      ayudante: '0.08',
      oficial: '0.02',
      herramienta: '0.02',
      maquina: '0.01',
      transporte: '0.005',
    };
  }
  if (unidadNormalizada === 'm3' || unidadNormalizada === 'm³') {
    return {
      ayudante: '0.35',
      oficial: '0.1',
      herramienta: '0.05',
      maquina: '0.03',
      transporte: '0.02',
    };
  }
  if (unidadNormalizada === 'ml' || unidadNormalizada === 'm') {
    return {
      ayudante: '0.25',
      oficial: '0.25',
      herramienta: '0.03',
      maquina: '0.02',
      transporte: '0.01',
    };
  }
  if (unidadNormalizada === 'und' || unidadNormalizada === 'unidad') {
    return {
      ayudante: '2',
      oficial: '1',
      herramienta: '0.25',
      maquina: '0.25',
      transporte: '0.1',
    };
  }
  if (
    unidadNormalizada === 'gbl' ||
    unidadNormalizada === 'glb' ||
    unidadNormalizada === 'global'
  ) {
    return {
      ayudante: '16',
      oficial: '8',
      herramienta: '2',
      maquina: '2',
      transporte: '1',
    };
  }
  if (unidadNormalizada === 'dia' || unidadNormalizada === 'dias') {
    return {
      ayudante: '8',
      oficial: '4',
      herramienta: '1',
      maquina: '1',
      transporte: '0.5',
    };
  }
  return {
    ayudante: '1',
    oficial: '0.25',
    herramienta: '0.1',
    maquina: '0.1',
    transporte: '0.05',
  };
}

function construirDesdeLineas(
  lineas: LineaBase[],
  cantidadBase: string,
  recursos: RecursoApuAutomatico[],
): DetalleApuAutomatico[] {
  return lineas.map((linea) => {
    const recursoEncontrado = recursos.find(
      (item) =>
        item.tipo === linea.tipo &&
        normalizar(item.descripcion) === normalizar(linea.descripcion) ||
        (linea.descripcion === 'Retroexcavadora de movimiento de tierra' &&
          normalizar(item.descripcion) ===
            'retroexcavadora (referencia excel)'),
    );

    if (!recursoEncontrado) {
      throw new InternalServerErrorException(
        `No se puede generar el APU porque falta el recurso '${linea.descripcion}' en el catálogo. Verifique la carga de recursos predeterminados.`,
      );
    }

    return {
      recursoId: recursoEncontrado.id,
      tipo: recursoEncontrado.tipo,
      cantidadPorUnidad: cantidadPorUnidad(linea.cantidad, cantidadBase),
    };
  });
}

export function construirApuAutomatico(
  nombre: string,
  unidad: string,
  recursos: RecursoApuAutomatico[],
): ResultadoApuAutomatico {
  const nombreNormalizado = normalizar(nombre);
  const referencia = recetasReferencia.find((item) =>
    item.patron.test(nombreNormalizado),
  );

  if (referencia) {
    return {
      metodo: 'referencia',
      referencia: `Rendimiento tomado de ${referencia.receta.nombre} en el modelo Excel. Agregue los recursos propios del proyecto que no aparezcan en esta receta.`,
      detalles: construirDesdeLineas(
        referencia.receta.lineas,
        referencia.receta.cantidadBase,
        recursos,
      ),
    };
  }

  const factores = cantidadAproximada(unidad);
  const lineas: LineaBase[] = [
    { ...recurso.ayudante, cantidad: factores.ayudante },
    { ...recurso.herramientas, cantidad: factores.herramienta },
  ];

  const actividadDeAlbanileria =
    /\b(concreto|adoquin|bordillo|cuneta|viga|tuberia|demolicion|reparacion)\b/.test(
      nombreNormalizado,
    );
  if (actividadDeAlbanileria) {
    lineas.push({ ...recurso.oficial, cantidad: factores.oficial });
  }

  const requiereMaquinaria =
    /\b(corte|excavacion|demolicion|compactacion|adoquin|bordillo|cuneta|viga|concreto|relleno|tuberia|prueba)\b/.test(
      nombreNormalizado,
    );
  if (requiereMaquinaria) {
    lineas.push({
      ...(nombreNormalizado.includes('compactacion') ||
      nombreNormalizado.includes('adoquin')
        ? recurso.compactador
        : recurso.retroexcavadora),
      cantidad: factores.maquina,
    });
  }

  const requiereTransporte =
    /\b(desalojo|retiro|acarreo|transporte|movilizacion|suministro)\b/.test(
      nombreNormalizado,
    );
  if (requiereTransporte) {
    lineas.push({ ...recurso.volquetaTransporte, cantidad: factores.transporte });
  }

  return {
    metodo: 'aproximado',
    referencia:
      'Rendimiento aproximado por unidad. Revise las cantidades y agregue los materiales que no tengan precio en el catálogo antes de aprobar el presupuesto.',
    detalles: construirDesdeLineas(lineas, '1', recursos),
  };
}

export async function recalcularCacheApu(
  tx: Prisma.TransactionClient,
  actividadId: string,
) {
  const receta = await tx.apuDetalle.findMany({
    where: { actividadId },
    include: { recurso: { select: { tipo: true, costoUnitario: true } } },
  });

  const preciosMap: Record<string, Prisma.Decimal> = {};
  const detallesCalculo = receta.map((detalle) => {
    preciosMap[detalle.recursoId] = detalle.recurso.costoUnitario;
    return {
      recursoId: detalle.recursoId,
      tipo: detalle.recurso.tipo,
      cantidadPorUnidad: detalle.cantidadPorUnidad,
    };
  });

  const costoCalculado = calcularApu(detallesCalculo, preciosMap);
  const fechaCalculo = new Date();

  return tx.apuCostoCache.upsert({
    where: { actividadId },
    update: { ...costoCalculado, fechaCalculo },
    create: { actividadId, ...costoCalculado, fechaCalculo },
  });
}

export async function sincronizarPresupuestosApu(
  tx: Prisma.TransactionClient,
  actividadId: string,
  cache: Awaited<ReturnType<typeof recalcularCacheApu>>,
) {
  const items = await tx.presupuestoItem.findMany({
    where: { actividadId },
    select: { id: true, presupuestoId: true },
  });
  const presupuestoIds = [...new Set(items.map((item) => item.presupuestoId))];

  for (const presupuestoId of presupuestoIds) {
    const itemsPresupuesto = await tx.presupuestoItem.findMany({
      where: { presupuestoId },
    });

    for (const item of itemsPresupuesto) {
      const costosActualizados =
        item.actividadId === actividadId
          ? {
              costoUnitarioCongelado: cache.costoTotal,
              costoMaterialesCong: cache.costoMateriales
                .mul(item.cantidadProyecto)
                .toDecimalPlaces(2),
              costoManoObraCong: cache.costoManoObra
                .mul(item.cantidadProyecto)
                .toDecimalPlaces(2),
              costoEquipoCong: cache.costoEquipo
                .mul(item.cantidadProyecto)
                .toDecimalPlaces(2),
              costoTransporteCong: cache.costoTransporte
                .mul(item.cantidadProyecto)
                .toDecimalPlaces(2),
            }
          : {
              costoUnitarioCongelado: item.costoUnitarioCongelado,
              costoMaterialesCong: item.costoMaterialesCong,
              costoManoObraCong: item.costoManoObraCong,
              costoEquipoCong: item.costoEquipoCong,
              costoTransporteCong: item.costoTransporteCong,
            };

      const totales = calcularTotalesLinea({
        cantidadProyecto: item.cantidadProyecto,
        costoMaterialesCong: costosActualizados.costoMaterialesCong,
        costoManoObraCong: costosActualizados.costoManoObraCong,
        costoEquipoCong: costosActualizados.costoEquipoCong,
        costoTransporteCong: costosActualizados.costoTransporteCong,
      });

      await tx.presupuestoItem.update({
        where: { id: item.id },
        data: { ...costosActualizados, total: totales.sumaTotal },
      });
    }

    const presupuesto = await tx.presupuesto.findUnique({
      where: { id: presupuestoId },
      select: {
        pctIndirectos: true,
        pctAdministracion: true,
        pctUtilidad: true,
        pctImpuestos: true,
        pctImprevistos: true,
      },
    });
    if (!presupuesto) continue;

    const lineasActualizadas = await tx.presupuestoItem.findMany({
      where: { presupuestoId },
    });
    const resumen = calcularResumenPresupuesto(lineasActualizadas, {
      pctIndirectos: presupuesto.pctIndirectos,
      pctAdministracion: presupuesto.pctAdministracion,
      pctUtilidad: presupuesto.pctUtilidad,
      pctImpuestos: presupuesto.pctImpuestos,
      pctImprevistos: presupuesto.pctImprevistos,
    });

    await tx.presupuesto.update({
      where: { id: presupuestoId },
      data: resumen,
    });
  }
}

export async function crearApuAutomaticoEnTransaccion(
  tx: Prisma.TransactionClient,
  actividad: { id: string; nombre: string; unidad: string },
  recursos: RecursoApuAutomatico[],
) {
  const resultado = construirApuAutomatico(
    actividad.nombre,
    actividad.unidad,
    recursos,
  );

  await tx.apuDetalle.createMany({
    data: resultado.detalles.map((detalle) => ({
      actividadId: actividad.id,
      recursoId: detalle.recursoId,
      cantidadPorUnidad: detalle.cantidadPorUnidad,
    })),
  });

  const cache = await recalcularCacheApu(tx, actividad.id);
  return { ...resultado, cache };
}
