import { ApiPropertyOptional } from '@nestjs/swagger';
import { TipoRecurso } from '@prisma/client';
import { IsIn, IsEnum, IsOptional } from 'class-validator';

/** Filtros opcionales para el Excel de catálogo de recursos. */
export class QueryCatalogoDto {
  @ApiPropertyOptional({ enum: TipoRecurso })
  @IsOptional()
  @IsEnum(TipoRecurso, { message: 'El tipo de recurso no es válido' })
  tipo?: TipoRecurso;

  @ApiPropertyOptional({
    enum: ['true', 'false'],
    description: 'Filtra por activos (true) o inactivos (false)',
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  activo?: string;
}
