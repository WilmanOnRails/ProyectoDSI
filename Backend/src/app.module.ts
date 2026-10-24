import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ScrapingController } from './scripts/scraping.controller.js';
import { ScrapingService } from './scripts/scraping.service.js'; // 👈 1. Importamos tu servicio de scraping

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [HealthController, ScrapingController],
  providers: [ScrapingService] // 👈 2. Registramos el servicio aquí (y quitamos el HealthController de esta línea)
})
export class AppModule { }
