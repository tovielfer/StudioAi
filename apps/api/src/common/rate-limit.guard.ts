import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.id ?? req.ip ?? 'anonymous';
    const key = `gen:${userId}`;
    const now = Date.now();

    const entry = this.hits.get(key);
    if (!entry || now > entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return true;
    }

    if (entry.count >= MAX_REQUESTS) {
      throw new HttpException(
        'Rate limit exceeded. Try again in a minute.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count++;
    return true;
  }
}
