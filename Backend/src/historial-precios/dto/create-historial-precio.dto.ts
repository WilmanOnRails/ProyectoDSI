import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsNumber, IsDate } from "class-validator";
export class CreateHistorialPrecioDto {

    @ApiProperty({ required: true, example: 'uuid-del-recurso-aqui', description: 'Id del recurso' })
    @IsNotEmpty()
    @IsString()
    recursoId: string;

    @ApiProperty({ required: true, example: 10.5 })
    @IsNotEmpty()
    @IsNumber()
    precio: number;

    @ApiProperty({ required: true, example: 'sinsa.com', description: 'Pagina donde se extraen los precios' })
    @IsNotEmpty()
    @IsString()
    fuente: string;

    @ApiProperty({ required: true, example: 10.5 })
    @IsNotEmpty()
    @IsDate()
    fecha: Date;

    @ApiProperty({ required: true, example: 'Jhon Dee', description: 'Persona que registro el precio' })
    @IsNotEmpty()
    @IsString()
    registradoPor: string;
}
