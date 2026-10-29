import { Module } from '@nestjs/common';
import { ScrapingController } from './scraping.controller.js';
import { ScrapingService } from './scraping.service.js';
import { RecursosModule } from '../recursos/recursos.module.js';

@Module({
  imports: [RecursosModule],
  controllers: [ScrapingController],
  providers: [ScrapingService],
  exports: [ScrapingService],
})
export class ScrapingModule {}
