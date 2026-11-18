import { Module } from '@nestjs/common';
import { DashboardModule } from '../dashboard/dashboard.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ReportesController } from './reportes.controller.js';
import { ReportesService } from './reportes.service.js';

@Module({
  imports: [PrismaModule, DashboardModule],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
