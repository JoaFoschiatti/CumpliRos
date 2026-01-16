import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

/**
 * SECURITY: Validate that critical secrets are properly configured
 * Prevents deployment with insecure default values
 */
function validateSecurityConfig(): void {
  const logger = new Logger('SecurityConfig');
  const jwtSecret = process.env.JWT_SECRET || '';
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || '';

  const insecurePatterns = ['CHANGE_ME', 'secret', 'password', '123456', 'default'];

  const isInsecure = (value: string): boolean => {
    if (value.length < 32) return true;
    return insecurePatterns.some(pattern =>
      value.toLowerCase().includes(pattern.toLowerCase())
    );
  };

  if (process.env.NODE_ENV === 'production') {
    if (isInsecure(jwtSecret)) {
      logger.error('FATAL: JWT_SECRET is insecure or not configured. Use: openssl rand -base64 32');
      process.exit(1);
    }
    if (isInsecure(jwtRefreshSecret)) {
      logger.error('FATAL: JWT_REFRESH_SECRET is insecure or not configured. Use: openssl rand -base64 32');
      process.exit(1);
    }
    logger.log('Security configuration validated successfully');
  } else {
    if (isInsecure(jwtSecret) || isInsecure(jwtRefreshSecret)) {
      logger.warn('WARNING: Using insecure JWT secrets. This is acceptable only for development.');
    }
  }
}

async function bootstrap() {
  // Validate security configuration before starting
  validateSecurityConfig();

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
      .setDescription('Panel de Cumplimiento Municipal Multi-jurisdiccion - API Documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('jurisdictions', 'Jurisdiction management')
      .addTag('templates', 'Obligation templates')
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
