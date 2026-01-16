import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation - only enabled in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('CumpliRos API')
      .setDescription('Panel de Cumplimiento Municipal Rosario - API Documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('organizations', 'Organization management')
      .addTag('locations', 'Location management')
      .addTag('users', 'User management')
      .addTag('obligations', 'Obligation management')
      .addTag('tasks', 'Task and checklist management')
      .addTag('documents', 'Document and evidence management')
      .addTag('reviews', 'Review and approval management')
      .addTag('audit', 'Audit log queries')
      .addTag('reports', 'Reports and exports')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    console.log(`Swagger docs at http://localhost:${process.env.PORT || 3001}/api/docs`);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`CumpliRos API running on http://localhost:${port}`);
}

bootstrap();
