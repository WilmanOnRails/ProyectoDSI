import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
<<<<<<< HEAD
import { ProjectsModule } from './projects/projects.module.js';
import { ActivitiesModule } from './activities/activities.module.js';
import { ApusModule } from './apus/apus.module.js';
import { HistorialPreciosModule } from './historial-precios/historial-precios.module.js';
import { ConfiguracionModule } from './configuracion/configuracion.module.js';
import { RecursosModule } from './recursos/recursos.module.js';
=======
import { ScrapingController } from './scripts/scraping.controller.js';
import { ScrapingService } from './scripts/scraping.service.js'; // 👈 1. Importamos tu servicio de scraping
>>>>>>> ef5fac4aaf7d232f8d063b598e406df178983a13

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
<<<<<<< HEAD
    ProjectsModule,
    ActivitiesModule,
    ApusModule,
    HistorialPreciosModule,
    ConfiguracionModule,
    RecursosModule,
  ],
  controllers: [HealthController],
})
export class AppModule { }

=======
  ],
  controllers: [HealthController, ScrapingController],
  providers: [ScrapingService] // 👈 2. Registramos el servicio aquí (y quitamos el HealthController de esta línea)
})
export class AppModule { }
>>>>>>> ef5fac4aaf7d232f8d063b598e406df178983a13
