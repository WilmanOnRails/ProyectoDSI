import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateConfiguracionDto {
  @ApiPropertyOptional({
    example: 'Constructora ABC',
    description: 'Nombre de la empresa',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  empresa?: string;

  @ApiPropertyOptional({
    example: 'J0310000000000',
    description: 'RUC de la empresa',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  ruc?: string;

  @ApiPropertyOptional({
    example: 'NIO',
    description: 'Moneda del sistema (código ISO 4217)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  moneda?: string;

  @ApiPropertyOptional({
    example: 15,
    description: 'Porcentaje de costos indirectos por defecto',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  pctIndirectosDef?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Porcentaje de utilidad por defecto',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  pctUtilidadDef?: number;

  @ApiPropertyOptional({
    example: 15,
    description: 'Porcentaje de impuestos por defecto',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  pctImpuestosDef?: number;
}
