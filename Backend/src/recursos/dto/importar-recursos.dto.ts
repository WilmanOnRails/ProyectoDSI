import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoRecurso } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Un producto tal como lo entrega el scraping de SINSA. */
export class ImportarRecursoDto {
  @ApiProperty({
    example: 'Cemento gris 42.5 kg',
    description: 'Nombre del producto (title del scraping)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  descripcion: string;

  @ApiProperty({ example: 'SINSA', description: 'Proveedor / tienda' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  proveedor: string;

  @ApiProperty({
    example: 'https://www.sinsa.com/producto',
    description: 'URL del producto (llave junto con el proveedor)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  urlProducto: string;

  @ApiProperty({ example: 495, description: 'Precio leído en la página' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precio: number;

  @ApiPropertyOptional({
    enum: TipoRecurso,
    default: TipoRecurso.material,
    description: 'Tipo de recurso (por defecto material)',
  })
  @IsOptional()
  @IsEnum(TipoRecurso)
  tipo?: TipoRecurso;

  @ApiPropertyOptional({
    example: 'Saco',
    description: 'Unidad. Si no viene, se usa "Unidad"',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  unidad?: string;

  @ApiPropertyOptional({ example: 'Cementos' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoria?: string;

  @ApiPropertyOptional({
    example: 'Cemento gris 42.5 kg',
    description: 'Nombre tal como lo publica el proveedor',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombreProveedor?: string;

  @ApiPropertyOptional({ example: 'https://.../imagen.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imagenUrl?: string;

  @ApiPropertyOptional({
    example: 'SINSA',
    description: 'Fuente del precio. Si no viene, se usa el proveedor',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fuente?: string;

  @ApiPropertyOptional({ example: 'Scraper SINSA' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registradoPor?: string;
}

export class ImportarRecursosDto {
  @ApiProperty({
    type: [ImportarRecursoDto],
    description: 'Lote de productos scrapeados',
  })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ImportarRecursoDto)
  recursos: ImportarRecursoDto[];
}
