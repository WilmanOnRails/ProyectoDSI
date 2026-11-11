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
import { ImportacionesModule } from './importaciones/importaciones.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { AccessControlModule } from './auth/access-control.module.js';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { ServeStaticModule } from '@nestjs/serve-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'), // Apunta a /app/public dentro del contenedor
      serveRoot: '/', // Se sirve en la raíz del sitio
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(process.cwd(), '.env'),
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
    ImportacionesModule,
    DashboardModule,
    AccessControlModule,
  ],
  controllers: [HealthController],
})
export class AppModule { }
