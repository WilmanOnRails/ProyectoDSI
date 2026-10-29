import { Controller, Get, Query } from '@nestjs/common';
import { ScrapingService } from './scraping.service.js'; // Importación limpia de TypeScript

@Controller('scraping')
export class ScrapingController {
  // NestJS inyectará la instancia real de tu servicio aquí de forma automática
  constructor(private readonly scrapingService: ScrapingService) {}

  @Get()
  async iniciarScraping(@Query('categoria') categoria: string) {
    // Si no pasan categoría, usamos por defecto 'electrodomesticos'
    return await this.scrapingService.ejecutarScraping(categoria || 'electrodomesticos');
  }
}
