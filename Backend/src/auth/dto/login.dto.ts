import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'correoEjemplo@gmail.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'contra123' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    required: false,
    default: false,
    description: 'Conservar la sesión al cerrar el navegador',
  })
  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}