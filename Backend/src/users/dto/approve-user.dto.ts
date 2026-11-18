import { ApiProperty } from '@nestjs/swagger';
import { Rol } from '@prisma/client';
import { IsIn } from 'class-validator';

export class ApproveUserDto {
  @ApiProperty({ enum: [Rol.presupuestista, Rol.solo_lectura] })
  @IsIn([Rol.presupuestista, Rol.solo_lectura], {
    message: 'No se puede asignar el rol de administrador',
  })
  rol: Rol;
}
