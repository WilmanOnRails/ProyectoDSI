import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateActivityDto {
    @ApiProperty({ required: true, example: '000.0' })
    @IsString()
    @IsNotEmpty()
    codigo: string;

    @ApiProperty({ required: true, example: 'Hacer mezcla' })
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @ApiProperty({ required: true, example: '0m2' })
    @IsString()
    @IsNotEmpty()
    unidad: string;
    /*
        @ApiProperty({ required: true, example: '1000.0' })
        @IsNotEmpty()
        valorEstimado: number;
        */
}
