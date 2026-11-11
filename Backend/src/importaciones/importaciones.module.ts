import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ImportacionesController } from './importaciones.controller.js';
import { ImportacionesService } from './importaciones.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ImportacionesController],
  providers: [ImportacionesService],
})
export class ImportacionesModule {}
