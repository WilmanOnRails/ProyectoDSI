import { Module } from '@nestjs/common';
import { HistorialPreciosService } from './historial-precios.service.js';
import { HistorialPreciosController } from './historial-precios.controller.js';

@Module({
  controllers: [HistorialPreciosController],
  providers: [HistorialPreciosService],
})
export class HistorialPreciosModule {}
