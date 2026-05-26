import {
  Controller,
  Get,
  Post,
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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

@Controller('generations')
export class GenerationsController {
  constructor(
    private readonly generationsService: GenerationsService,
    private readonly storageService: StorageService,
  ) {}

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
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (req.user.id !== userId) {
      throw new BadRequestException('Access denied');
    }
    return this.generationsService.findByUser(userId, {
      type,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.generationsService.findById(id, req.user.id);
  }
}
