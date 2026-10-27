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
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CambiarPrecioDto } from './dto/cambiar-precio.dto.js';
import { CreateRecursoDto } from './dto/create-recurso.dto.js';
import { QueryHistorialDto } from './dto/query-historial.dto.js';
import { QueryRecursoDto } from './dto/query-recurso.dto.js';
import { UpdateRecursoDto } from './dto/update-recurso.dto.js';
import { RecursosService } from './recursos.service.js';

@ApiTags('recursos')
@Controller('recursos')
export class RecursosController {
  constructor(private readonly recursosService: RecursosService) {}

  @Post()
  @ApiOperation({ summary: 'Crea un recurso y registra su precio inicial' })
  create(@Body() createRecursoDto: CreateRecursoDto) {
    return this.recursosService.create(createRecursoDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista recursos (filtra por tipo, estado y texto)',
  })
  findAll(@Query() query: QueryRecursoDto) {
    return this.recursosService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtiene un recurso por su ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.recursosService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza el recurso (no cambia el precio)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRecursoDto: UpdateRecursoDto,
  ) {
    return this.recursosService.update(id, updateRecursoDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desactiva un recurso (borrado lógico)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.recursosService.remove(id);
  }

  @Patch(':id/precio')
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
