import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class QueryActivityDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  pagina?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;

  @ApiPropertyOptional({ description: 'Filtra por proyecto', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  proyectoId?: string;
}
