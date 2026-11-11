import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, Min } from 'class-validator';

export class AgregarItemDto {
  @ApiProperty({ example: 'uuid-de-la-actividad' })
  @IsUUID()
  actividadId: string;

  @ApiProperty({
    example: 1250.5,
    description: 'Cantidad de esta actividad en el proyecto',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.0001)
  cantidadProyecto: number;
}
