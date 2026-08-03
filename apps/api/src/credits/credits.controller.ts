import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreditsService } from './credits.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddCreditsDto } from './dto/add-credits.dto';

@Controller('credits')
export class CreditsController {
  constructor(
    private readonly creditsService: CreditsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getBalance(@Req() req: { user: { id: string } }) {
    return this.creditsService.getBalance(req.user.id);
  }

  /**
   * Grants the one-time "installed the app" bonus. The web app calls this the
   * first time it detects it's running as an installed PWA (standalone mode).
   * Idempotent: safe to call on every app open — credits are added at most once
   * per user (enforced atomically in the service).
   */
  @Post('install-reward')
  @UseGuards(JwtAuthGuard)
  claimInstallReward(@Req() req: { user: { id: string } }) {
    return this.creditsService.grantInstallReward(req.user.id);
  }

  @Post('add')
  addCredits(
    @Headers('x-admin-secret') adminSecret: string,
    @Body() dto: AddCreditsDto,
  ) {
    const expected = this.config.get('ADMIN_SECRET', 'admin-secret-change-me');
    if (adminSecret !== expected) {
      throw new UnauthorizedException('Invalid admin secret');
    }
    return this.creditsService.addCredits(
      dto.userId,
      dto.amount,
      dto.reason || 'admin_add',
    );
  }
}
