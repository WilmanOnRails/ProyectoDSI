import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AgregarItemDto } from './dto/agregar-item.dto.js';
import { CreatePresupuestoDto } from './dto/create-presupuesto.dto.js';
import { UpdatePresupuestoDto } from './dto/update-presupuesto.dto.js';
import { PresupuestosService } from './presupuestos.service.js';

@ApiTags('presupuestos')
@Controller('presupuestos')
export class PresupuestosController {
  constructor(private readonly presupuestosService: PresupuestosService) {}

  @Post()
  @ApiOperation({
    summary: 'Crea un presupuesto para un proyecto (con porcentajes por defecto o personalizados)',
  })
  create(@Body() createPresupuestoDto: CreatePresupuestoDto) {
    return this.presupuestosService.create(createPresupuestoDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista todos los presupuestos con sus proyectos e ítems' })
  findAll() {
    return this.presupuestosService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene el detalle completo de un presupuesto' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.presupuestosService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza nombre o porcentajes y recalcula el presupuesto' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePresupuestoDto: UpdatePresupuestoDto,
  ) {
    return this.presupuestosService.update(id, updatePresupuestoDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina un presupuesto' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.presupuestosService.remove(id);
  }

  @Post(':id/items')
  @ApiOperation({
    summary: 'Agrega una actividad al presupuesto congelando su costo unitario y por categoría',
  })
  agregarItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() agregarItemDto: AgregarItemDto,
  ) {
    return this.presupuestosService.agregarItem(id, agregarItemDto);
  }

  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: 'Quita una actividad del presupuesto y recalcula los totales' })
  quitarItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.presupuestosService.quitarItem(id, itemId);
  }
}
