import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AdminGuard } from '../auth/guards/admin.guard.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, AdminGuard],
  imports: [PrismaModule]
})
export class UsersModule { }
