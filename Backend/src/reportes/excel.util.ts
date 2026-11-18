import ExcelJS from 'exceljs';
import type { Response } from 'express';

/** Formatos compartidos por todos los reportes en Excel. */
export const FORMATO_MONEDA = '"C$" #,##0.00';
export const FORMATO_FECHA = 'dd/mm/yyyy';

/** Escribe un título en la fila indicada y lo alonga por todas las columnas. */
export function titulo(
  sheet: ExcelJS.Worksheet,
  texto: string,
  columnas: number,
  fila?: number,
): ExcelJS.Row {
  const row = fila === undefined ? sheet.addRow([texto]) : sheet.getRow(fila);
  if (fila !== undefined) row.values = [texto];
  sheet.mergeCells(row.number, 1, row.number, columnas);
  row.font = { bold: true, size: 14, color: { argb: 'FF172338' } };
  return row;
}

/** Aplica el estilo de encabezado a una fila ya escrita. */
export function estilizarEncabezado(
  sheet: ExcelJS.Worksheet,
  fila: number,
): void {
  const row = sheet.getRow(fila);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' },
  };
  row.alignment = { vertical: 'middle' };
}

/** Devuelve el Excel como archivo descargable. */
export function enviarExcel(
  res: Response,
  buffer: Buffer,
  nombreArchivo: string,
): void {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=${nombreArchivo}.xlsx`,
  );
  res.send(buffer);
}
