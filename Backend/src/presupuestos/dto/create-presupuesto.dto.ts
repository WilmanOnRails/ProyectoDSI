import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePresupuestoDto {
  @ApiProperty({ example: 'uuid-del-proyecto' })
  @IsUUID()
  proyectoId: string;

  @ApiPropertyOptional({ example: 'Presupuesto base' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre?: string;

  @ApiPropertyOptional({
    example: 15,
    description: 'Si se omite, se toma de Configuracion',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  pctIndirectos?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Si se omite, se toma de Configuracion',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  pctUtilidad?: number;

  @ApiPropertyOptional({
    example: 15,
    description: 'Si se omite, se toma de Configuracion',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  pctImpuestos?: number;
}
