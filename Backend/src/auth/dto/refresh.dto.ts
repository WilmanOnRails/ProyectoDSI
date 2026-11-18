import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    description: 'Token de renovación entregado al iniciar sesión con Recordarme',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
