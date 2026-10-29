import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { ActivitiesModule } from './activities/activities.module.js';
import { ApusModule } from './apus/apus.module.js';
import { HistorialPreciosModule } from './historial-precios/historial-precios.module.js';
import { ConfiguracionModule } from './configuracion/configuracion.module.js';
import { RecursosModule } from './recursos/recursos.module.js';
import { PresupuestosModule } from './presupuestos/presupuestos.module.js';
import { ScrapingModule } from './scraping/scraping.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
    ActivitiesModule,
    ApusModule,
    HistorialPreciosModule,
    ConfiguracionModule,
    RecursosModule,
    PresupuestosModule,
    ScrapingModule,
  ],
  controllers: [HealthController],
})
export class AppModule { }

