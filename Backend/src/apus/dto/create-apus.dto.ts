import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';

export class CreateApusDto {
    @ApiProperty({ required: true, example: 'uuid-del-recurso-aqui', description: 'Id del recurso' })
    @IsNotEmpty()
    @IsString()
    recursoId: string;

    @ApiProperty({ required: true, example: 'uuid-de-la-actividad-aqui', description: 'Id de la actividad' })
    @IsNotEmpty()
    @IsString()
    actividadId: string;

    @ApiProperty({ required: true, example: 10.5 })
    @IsNotEmpty()
    @IsNumber({ maxDecimalPlaces: 4 })
    @Min(1)
    cantidadPorUnidad: number;
}