import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({ minLength: 1, maxLength: 72 })
  @IsString()
  @IsNotEmpty()
  @IsByteLength(1, 72, {
    message: 'La contraseña actual no puede exceder 72 bytes',
  })
  currentPassword: string;

  @ApiPropertyOptional({ example: 'Nombre Apellido', maxLength: 120 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre?: string;

  @ApiPropertyOptional({ example: 'correo@ejemplo.com', maxLength: 254 })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ minLength: 8, maxLength: 72 })
  @IsOptional()
  @IsString()
  @IsByteLength(8, 72, {
    message: 'La nueva contraseña debe tener entre 8 y 72 bytes',
  })
  newPassword?: string;
}
