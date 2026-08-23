import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from '../users/users.service';
import { API_TOKEN_PREFIX, hashApiToken } from './api-token.util';

/**
 * Accepts either a normal browser JWT session or a personal API token
 * (`Authorization: Bearer vpx_...`) used by MCP clients such as Claude. The
 * resolved user is attached to `req.user` in the same shape as JwtStrategy, so
 * downstream controllers are unchanged.
 */
@Injectable()
export class JwtOrApiKeyGuard extends AuthGuard('jwt') {
  constructor(private readonly usersService: UsersService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers?.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : undefined;

    if (token && token.startsWith(API_TOKEN_PREFIX)) {
      const user = await this.usersService.findByApiTokenHash(
        hashApiToken(token),
      );
      if (!user || user.isBlocked) {
        throw new UnauthorizedException('Invalid API token');
      }
      req.user = {
        id: user.id,
        email: user.email,
        credits: user.credits,
        role: user.role,
      };
      return true;
    }

    // No API token present — fall back to the standard JWT session guard.
    return (await super.canActivate(context)) as boolean;
  }
}
