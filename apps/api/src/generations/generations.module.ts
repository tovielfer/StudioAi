import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Generation } from './generation.entity';
import { GenerationsService, GENERATION_QUEUE } from './generations.service';
import { GenerationsController } from './generations.controller';
import { GenerationProcessor } from './generation.processor';
import { GenerationRunnerService } from './generation-runner.service';
import { CreditsModule } from '../credits/credits.module';
import { AiModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';

@Module({})
export class GenerationsModule {
  static register(syncMode: boolean): DynamicModule {
    return {
      module: GenerationsModule,
      imports: [
        TypeOrmModule.forFeature([Generation]),
        ...(syncMode
          ? []
          : [BullModule.registerQueue({ name: GENERATION_QUEUE })]),
        CreditsModule,
        AiModule,
        StorageModule,
      ],
      controllers: [GenerationsController],
      providers: [
        GenerationsService,
        GenerationRunnerService,
        ...(syncMode ? [] : [GenerationProcessor]),
      ],
      exports: [GenerationsService],
    };
  }
}
