import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RecursosController } from './recursos.controller.js';
import { RecursosService } from './recursos.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [RecursosController],
  providers: [RecursosService],
  exports: [RecursosService],
})
export class RecursosModule {}
