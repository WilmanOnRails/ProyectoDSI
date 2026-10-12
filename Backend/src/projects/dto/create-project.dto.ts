import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
export class CreateProjectDto {
    @ApiProperty({ required: true, example: 'Proyecto Ejemplo' })
    @IsString()
    @IsNotEmpty()
    nombre: string;

    @ApiProperty({ required: true, example: 'John Doe' })
    @IsString()
    @IsNotEmpty()
    cliente: string;

    @ApiProperty({ required: true, example: 'Avenida Principal' })
    @IsString()
    @IsNotEmpty()
    ubicacion: string;

    @ApiProperty({ required: true, example: '1000.0' })
    @IsNotEmpty()
    valorEstimado: number;
}
