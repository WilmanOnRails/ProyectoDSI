import { ApiPropertyOptional } from '@nestjs/swagger';
import { TipoRecurso } from '@prisma/client';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class QueryRecursoDto {
  @ApiPropertyOptional({ enum: TipoRecurso })
  @IsOptional()
  @IsEnum(TipoRecurso)
  tipo?: TipoRecurso;

  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description: 'Filtra por activos (true) o inactivos (false)',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  activo?: string;

  @ApiPropertyOptional({
    example: 'cemento',
    description: 'Busca en código, descripción y nombre de proveedor',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  buscar?: string;

  @ApiPropertyOptional({ example: 'Cementos', description: 'Filtra por categoría' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoria?: string;

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
}
