import { Module, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GenerationsModule } from './generations/generations.module';
import { CreditsModule } from './credits/credits.module';
import { StorageModule } from './storage/storage.module';
import { AiModule } from './ai/ai.module';
import { UploadsModule } from './uploads/uploads.module';
import { HealthController } from './health.controller';
import { User } from './users/user.entity';
import { Generation } from './generations/generation.entity';
import { CreditTransaction } from './credits/credit-transaction.entity';
import { isSyncQueue } from './config/env.loader';

@Module({})
export class AppModule {
  static register(): DynamicModule {
    const sync = isSyncQueue();

    const imports: DynamicModule['imports'] = [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: [
          join(process.cwd(), '.env'),
          join(process.cwd(), '../../.env'),
        ],
      }),
      TypeOrmModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          type: 'postgres',
          url: config.get<string>('DATABASE_URL'),
          entities: [User, Generation, CreditTransaction],
          migrations: [join(__dirname, 'database/migrations/*.{ts,js}')],
          migrationsRun: true,
          synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
        }),
      }),
      AuthModule,
      UsersModule,
      GenerationsModule.register(sync),
      CreditsModule,
      StorageModule,
      AiModule,
      UploadsModule,
    ];

    if (!sync) {
      imports.splice(
        2,
        0,
        BullModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            connection: {
              url: config.get('REDIS_URL', 'redis://localhost:6379'),
            },
          }),
        }),
      );
    }

    return { module: AppModule, imports, controllers: [HealthController] };
  }
}
