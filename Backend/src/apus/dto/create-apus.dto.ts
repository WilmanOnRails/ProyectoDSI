import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateApusDto {
    @ApiProperty({ required: true, example: 'uuid-del-recurso-aqui', description: 'Id del recurso' })
    @IsNotEmpty()
    @IsString()
    recursoId: string; // Cambiado a string (UUID)

    @ApiProperty({ required: true, example: 'uuid-de-la-actividad-aqui', description: 'Id de la actividad' })
    @IsNotEmpty()
    @IsString()
    actividadId: string; // Cambiado a string (UUID)

    @ApiProperty({ required: true, example: 10.5 })
    @IsNotEmpty()
    @IsNumber()
    cantidadPorUnidad: number; // O puedes renombrarlo directamente a cantidadPorUnidad
}