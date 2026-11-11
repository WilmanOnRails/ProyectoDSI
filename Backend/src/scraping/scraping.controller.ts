import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ScrapingService } from './scraping.service.js';
import { RecursosService } from '../recursos/recursos.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { WriteAccessGuard } from '../auth/guards/write-access.guard.js';

@Controller('scraping')
export class ScrapingController {
  constructor(
    private readonly scrapingService: ScrapingService,
    private readonly recursosService: RecursosService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
  async iniciarScraping(@Query('categoria') categoria: string) {
    return await this.scrapingService.ejecutarScraping(categoria || 'construccion');
  }

  @Post('sincronizar')
  @UseGuards(JwtAuthGuard, WriteAccessGuard)
  async sincronizarConBaseDeDatos(@Query('categoria') categoria: string) {
    const cat = categoria || 'construccion';
    const resultadoScraping = await this.scrapingService.ejecutarScraping(cat);

    // Mapear al DTO de importación masiva que ya creamos en el módulo recursos
    const recursosAImportar = resultadoScraping.products.map((p) => ({
      descripcion: p.descripcion,
      proveedor: 'SINSA',
      urlProducto: p.urlProducto || `https://www.sinsa.com.ni/${p.descripcion}`,
      precio: p.precio,
      tipo: 'material' as const,
      unidad: 'Unidad',
      categoria: p.categoria,
      nombreProveedor: p.descripcion,
      imagenUrl: p.imagenUrl || undefined,
      fuente: 'SINSA',
      registradoPor: 'Scraper Automatizado SINSA',
    }));

    // Ejecutar la importación idempotente en nuestra BD (Render)
    return await this.recursosService.importar({ recursos: recursosAImportar });
  }
}