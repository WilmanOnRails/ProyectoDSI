import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { CreateActivityDto } from './create-activity.dto.js';

export class UpdateActivityDto extends PartialType(
  OmitType(CreateActivityDto, [
    'proyectoId',
    'presupuestoId',
    'cantidadProyecto',
  ] as const),
) {
  @ApiPropertyOptional({ example: 'uuid-de-la-partida-del-presupuesto' })
  @IsOptional()
  @IsUUID()
  presupuestoItemId?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.0001)
  cantidadProyecto?: number;
}
