import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'correoEjemplo@gmail.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
