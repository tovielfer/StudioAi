import {
  Controller,
  Post,
  Delete,
  Body,
  Get,
  Query,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtOrApiKeyGuard } from './jwt-or-api-key.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: any) {
    // Initiates the Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: Response) {
    const { token } = await this.authService.googleLogin(req.user);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/success?token=${token}`);
  }

  @Get('me')
  @UseGuards(JwtOrApiKeyGuard)
  getMe(@Req() req: any) {
    return this.authService.getMe(req.user.id);
  }

  /**
   * Personal API token management for MCP clients (e.g. Claude). These are
   * guarded by the normal JWT session — a user manages their own token from the
   * dashboard. The token itself grants API access via ApiKeyStrategy.
   */
  @Get('api-token')
  @UseGuards(JwtAuthGuard)
  getApiToken(@Req() req: { user: { id: string } }) {
    return this.authService.getApiTokenInfo(req.user.id);
  }

  @Post('api-token')
  @UseGuards(JwtAuthGuard)
  createApiToken(@Req() req: { user: { id: string } }) {
    return this.authService.createApiToken(req.user.id);
  }

  @Delete('api-token')
  @UseGuards(JwtAuthGuard)
  revokeApiToken(@Req() req: { user: { id: string } }) {
    return this.authService.revokeApiToken(req.user.id);
  }
}
