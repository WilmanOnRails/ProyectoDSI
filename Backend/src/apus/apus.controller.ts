import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApusService } from './apus.service.js';
import { CreateApusDto } from './dto/create-apus.dto.js';
import { UpdateApusDto } from './dto/update-apus.dto.js';

@ApiTags('apus')
@Controller('apus')
export class ApusController {
  constructor(private readonly apusService: ApusService) {}

  @Post()
  @ApiOperation({
    summary:
      'Agrega un recurso a la receta (APU) de una actividad y recalcula su costo',
  })
  create(@Body() createApusDto: CreateApusDto) {
    return this.apusService.create(createApusDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista todos los detalles de APU de todas las actividades' })
  findAll() {
    return this.apusService.findAll();
  }

  @Get('actividad/:actividadId')
  @ApiOperation({
    summary: 'Obtiene la receta completa (APU) y el costo en caché de una actividad',
  })
  obtenerApuPorActividad(
    @Param('actividadId', ParseUUIDPipe) actividadId: string,
  ) {
    return this.apusService.obtenerApuPorActividad(actividadId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un detalle de APU por su ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.apusService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualiza la cantidad de un recurso en el APU y recalcula el costo',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateApusDto: UpdateApusDto,
  ) {
    return this.apusService.update(id, updateApusDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Elimina un recurso del APU de la actividad y recalcula su costo',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.apusService.remove(id);
  }
}
