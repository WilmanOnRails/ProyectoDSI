import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoRecurso } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRecursoDto {
  @ApiPropertyOptional({
    example: 'MAT-0001',
    description:
      'Código único. Si no se envía, el sistema lo genera (MAT/MO/EQ/TRA-0001).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigo?: string;

  @ApiProperty({ enum: TipoRecurso, example: TipoRecurso.material })
  @IsEnum(TipoRecurso)
  tipo: TipoRecurso;

  @ApiPropertyOptional({ example: 'Cementos' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  categoria?: string;

  @ApiProperty({ example: 'Cemento 42.5 kg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  descripcion: string;

  @ApiProperty({ example: 'Saco' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  unidad: string;

  @ApiProperty({
    example: 495,
    description: 'Precio unitario vigente (2 decimales)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costoUnitario: number;

  @ApiPropertyOptional({
    example: 'SINSA',
    description: 'Fuente del precio (Manual, SINSA, etc.)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fuente?: string;

  @ApiPropertyOptional({ example: true, description: 'Activo por defecto' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

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

  @ApiPropertyOptional({
    example: 'Jhon Dee',
    description: 'Quién registra el precio inicial (va al historial)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registradoPor?: string;
}
