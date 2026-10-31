import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsDateString,
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

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  pctImprevistos?: number;

  @ApiPropertyOptional({ example: 'PPTO-2026-001' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  numero?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  fechaVigencia?: string;

  @ApiPropertyOptional({ example: '30% de anticipo y pagos por avance mensual' })
  @IsOptional()
  @IsString()
  formaPago?: string;

  @ApiPropertyOptional({ example: '75 días calendario' })
  @IsOptional()
  @IsString()
  tiempoEjecucion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  exclusiones?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  garantias?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  responsableTecnico?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  anticipoPct?: number;
}
