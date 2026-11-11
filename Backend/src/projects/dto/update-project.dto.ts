import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { CreateProjectDto } from './create-project.dto.js';

export const ESTADOS_PROYECTO = [
  'En elaboración',
  'En ejecución',
  'Finalizado',
  'Cancelado',
] as const;

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiPropertyOptional({ enum: ESTADOS_PROYECTO })
  @IsOptional()
  @IsString()
  @IsIn(ESTADOS_PROYECTO, {
    message:
      'El estado debe ser En elaboración, En ejecución, Finalizado o Cancelado.',
  })
  estado?: (typeof ESTADOS_PROYECTO)[number];
}
