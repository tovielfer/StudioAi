import './config/env.loader';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { isSyncQueue } from './config/env.loader';

async function bootstrap() {
  const app = await NestFactory.create(AppModule.register());
  console.log('PORT FROM ENV:', process.env.PORT); // 👈 כאן

  const logger = new Logger('Bootstrap');

  const isProduction = process.env.NODE_ENV === 'production';
  const frontendUrl = process.env.FRONTEND_URL;

  if (isProduction && !frontendUrl) {
    throw new Error('FRONTEND_URL env variable is required in production');
  }

  app.enableCors({
    origin: frontendUrl || 'http://localhost:3000',
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

  console.log('PORT:', process.env.PORT);
  // const port = process.env.PORT || 3001;
  const port = process.env.PORT || 3001;
  if (!port) {
    throw new Error('PORT is not defined');
  }
  
  await app.listen(port, '0.0.0.0');
  // await app.listen(port, '0.0.0.0');
  logger.log(`API running on http://localhost:${port}`);
  if (isSyncQueue()) {
    logger.warn('QUEUE_MODE=sync — running without Redis (local dev)');
  }
}

bootstrap();