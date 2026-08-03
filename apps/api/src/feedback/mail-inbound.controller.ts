import {
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { MailInboundService } from './mail-inbound.service';

@Controller('mail')
export class MailInboundController {
  constructor(private readonly inbound: MailInboundService) {}

  // Public endpoint hit by Resend's `email.received` webhook. Authentication is
  // done via the Svix signature (verified in the service), not a guard.
  @Post('inbound')
  @HttpCode(200)
  async handleInbound(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string>,
  ) {
    const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body);
    return this.inbound.handleWebhook(rawBody, headers);
  }
}
