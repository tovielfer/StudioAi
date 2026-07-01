import './config/env.loader';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { isSyncQueue } from './config/env.loader';

async function bootstrap() {
  const app = await NestFactory.create(AppModule.register(), {
    // Preserve the raw request body so the inbound-email webhook can verify
    // its Svix signature against the exact bytes Resend signed.
    rawBody: true,
  });

  const logger = new Logger('Bootstrap');

  const isProduction = process.env.NODE_ENV === 'production';
  const frontendUrl = process.env.FRONTEND_URL;

  if (isProduction && !frontendUrl) {
    throw new Error('FRONTEND_URL env variable is required in production');
  }

  const allowedOrigins = [
    frontendUrl || 'http://localhost:3000',
    'https://vookapix.com',
    'https://www.vookapix.com',
    'https://studio-ai-web-phi.vercel.app',
  ].filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  const port = process.env.PORT || 3001;

  await app.listen(port, '0.0.0.0');
  logger.log(`API running on http://localhost:${port}`);
  if (isSyncQueue()) {
    logger.warn('QUEUE_MODE=sync — running without Redis (local dev)');
  }
}

bootstrap();