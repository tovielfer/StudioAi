import { BadRequestException } from '@nestjs/common';

const BLOCKED_PATTERNS = [
  /\b(nude|naked|nsfw|porn|sexual)\b/i,
  /\b(gore|violence|blood)\b/i,
  /\b(child|minor|underage)\b/i,
];

export function moderatePrompt(prompt: string): void {
  const trimmed = prompt.trim();
  if (trimmed.length < 3) {
    throw new BadRequestException('Prompt must be at least 3 characters');
  }
  if (trimmed.length > 2000) {
    throw new BadRequestException('Prompt must be under 2000 characters');
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new BadRequestException(
        'Prompt contains content that violates our guidelines',
      );
    }
  }
}
