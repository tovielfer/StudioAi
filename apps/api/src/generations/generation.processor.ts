import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { GENERATION_QUEUE } from './generations.service';
import { GenerationRunnerService } from './generation-runner.service';

interface GenerationJobData {
  generationId: string;
}

@Processor(GENERATION_QUEUE)
export class GenerationProcessor extends WorkerHost {
  constructor(private readonly runner: GenerationRunnerService) {
    super();
  }

  async process(job: Job<GenerationJobData>) {
    const { generationId } = job.data;
    const isLastAttempt =
      job.attemptsMade >= (job.opts.attempts ?? 1) - 1;

    try {
      await this.runner.run(generationId, isLastAttempt);
    } catch {
      if (!isLastAttempt) throw new Error('Retry generation');
    }
  }
}
