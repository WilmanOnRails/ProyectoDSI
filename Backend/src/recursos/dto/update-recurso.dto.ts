import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateRecursoDto } from './create-recurso.dto.js';

/**
 * El precio NO se edita por aquí: se cambia con PATCH /recursos/:id/precio
 * para que quede registrado en el historial.
 */
export class UpdateRecursoDto extends PartialType(
  OmitType(CreateRecursoDto, ['costoUnitario', 'registradoPor'] as const),
) {}
