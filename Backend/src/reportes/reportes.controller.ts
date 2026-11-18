import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { QueryCatalogoDto } from './dto/query-catalogo.dto.js';
import { enviarExcel } from './excel.util.js';
import { ReportesService } from './reportes.service.js';

@ApiTags('reportes')
@Controller('reportes')
@UseGuards(JwtAuthGuard)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('resumen')
  @ApiOperation({
    summary: 'Exporta el resumen general del sistema en formato Excel (.xlsx)',
  })
  async resumen(@Res() res: Response) {
    const buffer = await this.reportesService.resumen();
    enviarExcel(res, buffer, 'reporte-resumen');
  }

  @Get('catalogo-recursos')
  @ApiOperation({
    summary: 'Exporta el catálogo de recursos con sus precios en Excel (.xlsx)',
  })
  async catalogo(
    @Query() query: QueryCatalogoDto,
    @Res() res: Response,
  ) {
    const buffer = await this.reportesService.catalogo(query);
    enviarExcel(res, buffer, 'reporte-catalogo-recursos');
  }
}
