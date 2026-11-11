import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AgregarItemDto } from './dto/agregar-item.dto.js';
import { CreatePresupuestoDto } from './dto/create-presupuesto.dto.js';
import { QueryPresupuestoResumenDto } from './dto/query-presupuesto-resumen.dto.js';
import { UpdatePresupuestoDto } from './dto/update-presupuesto.dto.js';
import { PresupuestosService } from './presupuestos.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { WriteAccessGuard } from '../auth/guards/write-access.guard.js';

@ApiTags('presupuestos')
@Controller('presupuestos')
export class PresupuestosController {
  constructor(private readonly presupuestosService: PresupuestosService) {}

  @Post()
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
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

  @Get('resumen')
  @ApiOperation({ summary: 'Lista presupuestos con datos resumidos para la pantalla principal' })
  findAllResumidos(@Query() query: QueryPresupuestoResumenDto) {
    return this.presupuestosService.findAllResumidos(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene el detalle completo de un presupuesto' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.presupuestosService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
  @ApiOperation({ summary: 'Actualiza nombre o porcentajes y recalcula el presupuesto' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePresupuestoDto: UpdatePresupuestoDto,
  ) {
    return this.presupuestosService.update(id, updatePresupuestoDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
  @ApiOperation({ summary: 'Elimina un presupuesto' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.presupuestosService.remove(id);
  }

  @Post(':id/items')
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
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
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
  @ApiOperation({ summary: 'Quita una actividad del presupuesto y recalcula los totales' })
  quitarItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.presupuestosService.quitarItem(id, itemId);
  }

  @Post(':id/sincronizar')
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
  @ApiOperation({
    summary: 'Sincroniza y actualiza los costos del presupuesto con los APU actuales de las actividades',
  })
  sincronizarCostos(@Param('id', ParseUUIDPipe) id: string) {
    return this.presupuestosService.sincronizarCostos(id);
  }

  @Get(':id/excel')
  @ApiOperation({ summary: 'Exporta el presupuesto en formato Excel (.xlsx)' })
  async exportarExcel(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.presupuestosService.exportarExcel(id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=presupuesto-${id}.xlsx`,
    );
    res.send(buffer);
  }
}
