import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GenerationsService } from './generations.service';
import { CreateGenerationDto } from './dto/create-generation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { StorageService } from '../storage/storage.service';
import { GenerationType } from '../common/constants';
import {
  ImageQuality,
  ImageSize,
  ImageResolution,
  AiProvider,
  GenerationStatus,
} from '../common/constants';
import { AiPricingService } from '../ai/ai-pricing.service';
import { normalizeAttrs, MODEL_REGISTRY } from '../common/model-capabilities';
import { MailService } from '../mail/mail.service';

// Google caps inline image uploads at 7MB; keep one consistent limit.
const MAX_FILE_SIZE = 7 * 1024 * 1024; // 7MB

@Controller('generations')
export class GenerationsController {
  constructor(
    private readonly generationsService: GenerationsService,
    private readonly storageService: StorageService,
    private readonly pricingService: AiPricingService,
    private readonly mailService: MailService,
  ) {}

  // Public capabilities registry: single source of truth for the create-form
  // dropdowns (sizes/qualities/resolutions per model and provider).
  @Get('models')
  getModels(@Query('type') type?: GenerationType) {
    return type
      ? MODEL_REGISTRY.filter((m) => m.type === type)
      : MODEL_REGISTRY;
  }

  @Get('cost')
  @UseGuards(JwtAuthGuard)
  getCost(
    @Query('provider') provider: string,
    @Query('model') model: string,
    @Query('size') size: string,
    @Query('quality') quality: string,
    @Query('resolution') resolution?: string,
    @Query('hasReference') hasReference?: string,
    @Query('type') type?: GenerationType,
    @Query('durationSeconds') durationSeconds?: string,
    @Query('generateAudio') generateAudio?: string,
  ) {
    const resolvedProvider = provider ?? AiProvider.MOCK;
    const resolvedModel = model ?? 'gpt-image-1';
    // Mirror the normalization applied at create() so the previewed cost
    // matches the cost actually charged.
    const normalized = normalizeAttrs(
      resolvedModel,
      quality ?? ImageQuality.AUTO,
      resolution ?? ImageResolution.ONE_K,
    );
    const parsedDuration = durationSeconds
      ? parseInt(durationSeconds, 10)
      : undefined;
    return this.pricingService.getGenerationCost({
      provider: resolvedProvider,
      model: resolvedModel,
      size: size ?? ImageSize.SQUARE,
      quality: normalized.quality,
      resolution: normalized.resolution,
      hasReference: hasReference === 'true',
      type: type ?? GenerationType.IMAGE,
      durationSeconds: Number.isFinite(parsedDuration as number)
        ? parsedDuration
        : undefined,
      generateAudio: generateAudio === 'true',
    });
  }

  @Post('create')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  create(
    @Req() req: { user: { id: string } },
    @Body() dto: CreateGenerationDto,
  ) {
    return this.generationsService.create(req.user.id, dto);
  }

  @Post('upload-reference')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image files allowed'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async uploadReference(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const url = await this.storageService.uploadBuffer(
      file.buffer,
      file.originalname.split('.').pop() || 'png',
      file.mimetype,
    );
    return { url };
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  findByUser(
    @Req() req: { user: { id: string } },
    @Param('userId') userId: string,
    @Query('type') type?: GenerationType,
    @Query('excludeStatus') excludeStatus?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (req.user.id !== userId) {
      throw new BadRequestException('Access denied');
    }
    // Accept a comma-separated list of statuses to hide (e.g. "failed,cancelled"
    // so the dashboard can show only successful/in-progress creations). Only
    // known statuses are honoured; anything else is silently ignored.
    const validStatuses = Object.values(GenerationStatus) as string[];
    const excludeStatuses = excludeStatus
      ? (excludeStatus
          .split(',')
          .map((s) => s.trim())
          .filter((s) => validStatuses.includes(s)) as GenerationStatus[])
      : undefined;
    return this.generationsService.findByUser(userId, {
      type,
      excludeStatuses,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post(':id/deliver')
  @UseGuards(JwtAuthGuard)
  async sendEmail(
    @Req() req: { user: { id: string; email: string } },
    @Param('id') id: string,
  ) {
    // findById enforces ownership (throws if the generation belongs to someone
    // else), so we don't need a separate authorization check here.
    const generation = await this.generationsService.findById(id, req.user.id);

    if (generation.status !== GenerationStatus.DONE || !generation.resultUrl) {
      throw new BadRequestException('Generation is not ready to be sent');
    }

    await this.mailService.sendGenerationImage({
      to: req.user.email,
      generation,
    });

    return { success: true };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.generationsService.findById(id, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.generationsService.remove(id, req.user.id);
  }
}
