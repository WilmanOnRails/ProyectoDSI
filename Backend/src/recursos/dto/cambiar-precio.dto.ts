import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CambiarPrecioDto {
  @ApiProperty({ example: 520, description: 'Nuevo precio unitario' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precio: number;

  @ApiPropertyOptional({ example: 'SINSA', description: 'Fuente del precio' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fuente?: string;

  @ApiPropertyOptional({
    example: 'Jhon Dee',
    description: 'Quién registra el cambio de precio',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registradoPor?: string;

  @ApiPropertyOptional({ example: 'SINSA' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  proveedor?: string;

  @ApiPropertyOptional({ example: 'Cemento gris 42.5 kg' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombreProveedor?: string;

  @ApiPropertyOptional({ example: 'https://www.sinsa.com/.../producto' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  urlProducto?: string;

  @ApiPropertyOptional({ example: 'https://.../imagen.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imagenUrl?: string;
}
