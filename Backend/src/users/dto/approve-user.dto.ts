import { ApiProperty } from '@nestjs/swagger';
import { Rol } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ApproveUserDto {
  @ApiProperty({ enum: Rol })
  @IsEnum(Rol, { message: 'El rol seleccionado no es válido' })
  rol: Rol;
}
