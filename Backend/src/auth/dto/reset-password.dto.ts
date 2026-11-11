import { ApiProperty } from '@nestjs/swagger';
import {
  IsByteLength,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token recibido por correo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token: string;

  @ApiProperty({
    minLength: 8,
    maxLength: 72,
    description: 'Nueva contraseña de entre 8 y 72 bytes',
  })
  @IsString()
  @IsByteLength(8, 72, {
    message: 'La contraseña debe tener entre 8 y 72 bytes',
  })
  password: string;
}
