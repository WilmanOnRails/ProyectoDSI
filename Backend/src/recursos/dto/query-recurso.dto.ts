import { ApiPropertyOptional } from '@nestjs/swagger';
import { TipoRecurso } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
