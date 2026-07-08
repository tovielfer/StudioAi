import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user.entity';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await this.usersService
      .create(dto.email, passwordHash, {
        emailVerificationToken: token,
        emailVerificationExpiry: expiry,
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw new UnauthorizedException('Email already registered');
        }
        throw error;
      });

    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

    await this.mailService.sendEmailVerification({ to: user.email, verifyUrl });

    return { message: 'Verification email sent' };
  }

  async verifyEmail(token: string) {
    const user = await this.usersService.findByEmailVerificationToken(token);
    if (!user || !user.emailVerificationExpiry) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    if (user.emailVerificationExpiry < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    if (user.isBlocked) {
      throw new UnauthorizedException('User is blocked');
    }

    await this.usersService.markEmailVerified(user.id);
    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('User is blocked');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Please login with Google');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    return this.buildAuthResponse(user);
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return { message: 'If this email exists, a reset link was sent' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000);
    await this.usersService.setResetPasswordToken(user.id, token, expiry);

    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.mailService.sendPasswordReset({ to: email, resetUrl });

    return { message: 'If this email exists, a reset link was sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersService.findByResetPasswordToken(token);
    if (!user || !user.resetPasswordExpiry) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    if (user.resetPasswordExpiry < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.resetPassword(user.id, passwordHash);

    return { message: 'Password reset successfully' };
  }

  async validateGoogleUser(profile: {
    email: string;
    googleId: string;
    avatarUrl?: string;
  }) {
    let user = await this.usersService.findByEmail(profile.email);

    if (user) {
      // If user exists but doesn't have googleId, we could link them, but for now let's just return the user
      // Or we can update the googleId and avatarUrl if they are missing
      if (!user.googleId) {
        // We could update the user here, but TypeORM update is needed.
        // For simplicity, we just return the user.
      }
      if (user.isBlocked) {
        throw new UnauthorizedException('User is blocked');
      }
      return user;
    }

    // User doesn't exist, create a new one
    user = await this.usersService.create(profile.email, null, {
      googleId: profile.googleId,
      avatarUrl: profile.avatarUrl,
      emailVerified: true, // Google emails are already verified
    });

    return user;
  }

  async googleLogin(user: any) {
    return this.buildAuthResponse(user);
  }

  async getMe(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return {
      id: user.id,
      email: user.email,
      credits: user.credits,
      role: user.role,
      hasSavedCard: Boolean(user.sumitCustomerId && user.sumitPaymentMethodId),
      savedCardLast4: user.savedCardLast4,
      savedCardBrand: user.savedCardBrand,
    };
  }

  private buildAuthResponse(user: {
    id: string;
    email: string;
    credits: number;
    role: UserRole;
    isBlocked?: boolean;
  }) {
    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        credits: user.credits,
        role: user.role,
      },
    };
  }
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}
