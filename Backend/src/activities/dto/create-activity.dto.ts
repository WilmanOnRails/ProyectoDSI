import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class CreateActivityDto {
  @ApiProperty({ example: 'Excavación manual de zanja' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'm3' })
  @IsString()
  @IsNotEmpty()
  unidad: string;

  @ApiProperty({ example: '010' })
  @IsString()
  @IsNotEmpty()
  capituloCodigo: string;

  @ApiProperty({ example: 'PRELIMINARES' })
  @IsString()
  @IsNotEmpty()
  capituloNombre: string;

  @ApiProperty({ example: 'uuid-del-proyecto' })
  @IsUUID()
  proyectoId: string;

  @ApiProperty({ example: 'uuid-del-presupuesto-del-proyecto' })
  @IsUUID()
  presupuestoId: string;

  @ApiProperty({ example: 25.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.0001)
  cantidadProyecto: number;
}
