import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { PrismaService } from './prisma/prisma.service.js';

function origenesCors(): boolean | string[] {
  const crudo = process.env.CORS_ORIGIN?.trim();
  const esDesarrollo = process.env.NODE_ENV !== 'production';

  if (!crudo) {
    return esDesarrollo ? true : [];
  }
  if (crudo === '*') {
    return true;
  }
  return crudo
    .split(',')
    .map((origen) => origen.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const origen = origenesCors();
  app.enableCors({
    origin: origen,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Presupuestos de construcción')
    .setDescription(
      'API para armar y automatizar presupuestos de construcción en Nicaragua (C$).',
    )
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      in: 'header',
      name: 'Authorization',
      description: 'Enter your bearer token'
    })
    .addSecurityRequirements('bearer')
    .build();
  const documento = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, documento, {
    useGlobalPrefix: true,
  });

  const puerto = process.env.PORT ?? 3000;
  await app.listen(puerto, '0.0.0.0');
}

await bootstrap();
