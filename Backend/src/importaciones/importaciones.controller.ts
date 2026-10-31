import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ImportacionesService } from './importaciones.service.js';

type ArchivoSubido = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

class ImportarPliegoDto {
  @ApiProperty({
    required: false,
    example: 'Presupuesto base - PLIEGO_1',
    description: 'Nombre opcional para el presupuesto importado',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombrePresupuesto?: string;
}

@ApiTags('importaciones')
@Controller('importaciones')
export class ImportacionesController {
  constructor(
    private readonly importacionesService: ImportacionesService,
  ) {}

  @Post('pliego-pdf')
  @ApiOperation({
    summary:
      'Extrae actividades, cantidades y unidades de un pliego PDF y crea un proyecto y presupuesto nuevos',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        archivo: { type: 'string', format: 'binary' },
        nombrePresupuesto: { type: 'string' },
      },
      required: ['archivo'],
    },
  })
  @UseInterceptors(FileInterceptor('archivo'))
  async importarPliego(
    @UploadedFile() archivo: ArchivoSubido,
    @Body() datos: ImportarPliegoDto,
  ) {
    if (!archivo) {
      throw new BadRequestException(
        'Debe adjuntar un archivo PDF en el campo archivo',
      );
    }

    if (archivo.mimetype !== 'application/pdf') {
      throw new BadRequestException('El archivo debe ser un PDF');
    }

    return this.importacionesService.importarPliegoPdf(
      archivo.buffer,
      archivo.originalname,
      datos.nombrePresupuesto,
    );
  }
}
