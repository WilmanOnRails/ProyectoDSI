import { describe, expect, it } from 'vitest';
import { extraerDatosPliegoGenerico } from './pliego-parser.js';

/** El formato 2: una palabra por línea y otro título de sección. */
const FORMATO_2 = [
  'ALCALDÍA DE MATEARE',
  'DESGLOSE DE PRESUPUESTO',
  'Tabla: ALCANC',
  '010', '|', 'Demoliciones', 'gib', '1.00',
  '001_|', 'Desinstalacion', 'cerca', 'mi', '80.17',
  'B', '|', 'MOVIMIENTO', 'DE', 'TIERRA', 'E',
  '010_|', 'Movilización', 'de', 'Equipos.', 'gbl', '1.00',
  '020', 'Corte', 'con', 'equipo', 'm3', '558.00',
  'MATRIZ DE EVALUACIÓN TÉCNICA',
].join('\n');

/**
 * El formato de PLIEGO_1: la cantidad va ANTES de la unidad, hay filas de
 * varias líneas y unidades como "und" y "días".
 */
const FORMATO_VIEJO = [
  'DESGLOSE DE ALCANCES',
  'ALCANCES DEL PROYECTO: Mejoramiento de calles',
  'ALCALDÍA MUNICIPAL DE MATERIAL',
  'ÍTEM DESCRIPCIÓN CANT U/M',
  '010 PRELIMINARES',
  '001 Limpieza inicial. 3,710.36 m2',
  '002',
  'Corte, tala y destronque de árbol. Incluye corte, extracción de raices, carga, retiro y',
  'desalojo del material vegetal resultante a sitio autorizado.',
  '3.00 und',
  '007 Topografía para el replanteo. 10.00 días',
  '020 MOVIMIENTO DE TIERRA',
  '001 Corte de terreno con equipo. 1,298.63 m3',
  'Matriz de Evaluación Técnica',
].join('\n');

/** Ni siquiera tiene título: solo filas con la forma esperada. */
const SIN_TITULO = [
  '001', 'Desinstalacion', 'cerca', 'mi', '80.17',
  '002', 'Limpieza', 'inicial', 'm2', '1,300.00',
].join('\n');

describe('extraerDatosPliegoGenerico', () => {
  it('extrae el formato 2 sin mirar el título', () => {
    const datos = extraerDatosPliegoGenerico(FORMATO_2, 'formato 2.pdf');

    expect(datos.actividades).toHaveLength(3);
    expect(datos.actividades[0]).toMatchObject({
      descripcion: 'Desinstalacion cerca',
      unidad: 'mi',
      capituloCodigo: '010',
    });
    expect(datos.actividades[1].cantidad.toString()).toBe('1');
    expect(datos.actividades[1].unidad).toBe('global');
    expect(datos.actividades[2].capituloCodigo).toBe('B');
  });

  it('sigue extrayendo el formato de PLIEGO_1', () => {
    const datos = extraerDatosPliegoGenerico(FORMATO_VIEJO, 'pliego.pdf');

    expect(datos.cliente).toBe('ALCALDÍA MUNICIPAL DE MATERIAL');
    expect(datos.nombreProyecto).toBe('Mejoramiento de calles');
    expect(datos.actividades).toHaveLength(4);
    expect(datos.actividades.map((a) => a.cantidad.toString())).toEqual([
      '3710.36',
      '3',
      '10',
      '1298.63',
    ]);
    expect(datos.actividades.map((a) => a.unidad)).toEqual([
      'm2',
      'u',
      'días',
      'm3',
    ]);
    expect(datos.actividades[1].descripcion).toContain('Corte, tala y destronque');
    expect(datos.actividades[3].capituloCodigo).toBe('020');
  });

  it('funciona aunque el PDF no tenga ningún encabezado conocido', () => {
    const datos = extraerDatosPliegoGenerico(SIN_TITULO, 'sin-titulo.pdf');

    expect(datos.actividades).toHaveLength(2);
    expect(datos.actividades[1].unidad).toBe('m2');
    expect(datos.actividades[1].cantidad.toString()).toBe('1300');
    expect(datos.nombreProyecto).toBe('Pliego importado - sin-titulo.pdf');
  });

  it('respeta el nombre de presupuesto que mande el usuario', () => {
    const datos = extraerDatosPliegoGenerico(
      SIN_TITULO,
      'sin-titulo.pdf',
      'Presupuesto base',
    );
    expect(datos.nombreProyecto).toBe('Presupuesto base');
  });
});
