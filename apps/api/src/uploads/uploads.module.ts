import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as express from 'express';
import * as path from 'path';

@Module({ imports: [ConfigModule] })
export class UploadsModule implements NestModule {
  constructor(private readonly config: ConfigService) {}

  configure(consumer: MiddlewareConsumer) {
    if (this.config.get('STORAGE_TYPE', 'local') !== 'local') return;

    const uploadsPath = path.resolve(
      process.cwd(),
      this.config.get('LOCAL_STORAGE_PATH', './uploads'),
    );

    consumer.apply(express.static(uploadsPath)).forRoutes('/uploads');
  }
}
