import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Rol } from '@prisma/client';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { CreateUserDto } from './create-user.dto.js';

/**
 * Además de los datos del usuario, permite cambiar su rol y su estado.
 * El precio de esto es que el backend debe verificar que un administrador
 * no se cambie el rol ni se desactive a sí mismo (se valida en el service).
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ enum: [Rol.presupuestista, Rol.solo_lectura] })
  @IsOptional()
  @IsIn([Rol.presupuestista, Rol.solo_lectura], {
    message: 'No se puede asignar el rol de administrador',
  })
  rol?: Rol;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
