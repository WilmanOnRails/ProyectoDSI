import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { HistorialPreciosService } from './historial-precios.service.js';
import { CreateHistorialPrecioDto } from './dto/create-historial-precio.dto.js';
import { UpdateHistorialPrecioDto } from './dto/update-historial-precio.dto.js';

@Controller('historial-precios')
export class HistorialPreciosController {
  constructor(private readonly historialPreciosService: HistorialPreciosService) { }

  @Post()
  create(@Body() createHistorialPrecioDto: CreateHistorialPrecioDto) {
    return this.historialPreciosService.create(createHistorialPrecioDto);
  }

  @Get()
  findAll() {
    return this.historialPreciosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.historialPreciosService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateHistorialPrecioDto: UpdateHistorialPrecioDto) {
    return this.historialPreciosService.update(id, updateHistorialPrecioDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.historialPreciosService.remove(id);
  }
}
