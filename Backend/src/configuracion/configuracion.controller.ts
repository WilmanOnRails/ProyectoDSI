import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfiguracionService } from './configuracion.service.js';
import { UpdateConfiguracionDto } from './dto/update-configuracion.dto.js';

@ApiTags('configuracion')
@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene los parámetros generales del sistema' })
  obtener() {
    return this.configuracionService.obtener();
  }

  @Patch()
  @ApiOperation({ summary: 'Actualiza los parámetros generales del sistema' })
  actualizar(@Body() updateConfiguracionDto: UpdateConfiguracionDto) {
    return this.configuracionService.actualizar(updateConfiguracionDto);
  }
}
