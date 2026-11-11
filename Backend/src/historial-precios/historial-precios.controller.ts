import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { HistorialPreciosService } from './historial-precios.service.js';
import { CreateHistorialPrecioDto } from './dto/create-historial-precio.dto.js';
import { UpdateHistorialPrecioDto } from './dto/update-historial-precio.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { WriteAccessGuard } from '../auth/guards/write-access.guard.js';

@Controller('historial-precios')
export class HistorialPreciosController {
  constructor(private readonly historialPreciosService: HistorialPreciosService) { }

  @Post()
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
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
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
  update(@Param('id') id: string, @Body() updateHistorialPrecioDto: UpdateHistorialPrecioDto) {
    return this.historialPreciosService.update(id, updateHistorialPrecioDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
  remove(@Param('id') id: string) {
    return this.historialPreciosService.remove(id);
  }
}
