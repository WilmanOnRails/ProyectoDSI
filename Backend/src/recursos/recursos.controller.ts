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
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CambiarPrecioDto } from './dto/cambiar-precio.dto.js';
import { CreateRecursoDto } from './dto/create-recurso.dto.js';
import { ImportarRecursosDto } from './dto/importar-recursos.dto.js';
import { QueryHistorialDto } from './dto/query-historial.dto.js';
import { QueryRecursoDto } from './dto/query-recurso.dto.js';
import { UpdateRecursoDto } from './dto/update-recurso.dto.js';
import { RecursosService } from './recursos.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { WriteAccessGuard } from '../auth/guards/write-access.guard.js';

@ApiTags('recursos')
@Controller('recursos')
export class RecursosController {
  constructor(private readonly recursosService: RecursosService) {}

  @Post()
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
  @ApiOperation({ summary: 'Crea un recurso y registra su precio inicial' })
  create(@Body() createRecursoDto: CreateRecursoDto) {
    return this.recursosService.create(createRecursoDto);
  }

  @Post('seed-defaults')
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
  @ApiOperation({ summary: 'Inserta recursos por defecto de mano de obra, equipo y transporte' })
  seedDefaults() {
    return this.recursosService.seedDefaults();
  }

  @Post('importar')
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
  @ApiOperation({
    summary:
      'Importa recursos del scraping (crea o actualiza por proveedor + URL)',
  })
  importar(@Body() importarRecursosDto: ImportarRecursosDto) {
    return this.recursosService.importar(importarRecursosDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista recursos (filtra por tipo, estado y texto)',
  })
  findAll(@Query() query: QueryRecursoDto) {
    return this.recursosService.findAll(query);
  }

  @Get('opciones')
  @ApiOperation({ summary: 'Lista las categorías y unidades disponibles en recursos activos' })
  opciones() {
    return this.recursosService.obtenerOpciones();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un recurso por su ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.recursosService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
  @ApiOperation({ summary: 'Actualiza el recurso (no cambia el precio)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRecursoDto: UpdateRecursoDto,
  ) {
    return this.recursosService.update(id, updateRecursoDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
  @ApiOperation({ summary: 'Desactiva un recurso (borrado lógico)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.recursosService.remove(id);
  }

  @Patch(':id/precio')
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
  @ApiOperation({
    summary:
      'Registra un precio nuevo en el historial y actualiza el precio vigente',
  })
  cambiarPrecio(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() cambiarPrecioDto: CambiarPrecioDto,
  ) {
    return this.recursosService.cambiarPrecio(id, cambiarPrecioDto);
  }

  @Get(':id/historial')
  @ApiOperation({ summary: 'Historial de precios (más reciente primero)' })
  historial(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryHistorialDto,
  ) {
    return this.recursosService.historial(id, query);
  }
}
