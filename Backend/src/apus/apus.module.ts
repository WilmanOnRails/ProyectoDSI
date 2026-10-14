import { Module } from '@nestjs/common';
import { ApusService } from './apus.service.js';
import { ApusController } from './apus.controller.js';

@Module({
  controllers: [ApusController],
  providers: [ApusService],
})
export class ApusModule {}
