import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { MailService } from '../mail/mail.service';
import { FeedbackService } from './feedback.service';

interface ReceivedWebhookPayload {
  type?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    message_id?: string;
    received_for?: string[];
  };
}

@Injectable()
export class MailInboundService {
  private readonly logger = new Logger(MailInboundService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly feedbackService: FeedbackService,
  ) {}

  async handleWebhook(rawBody: string, headers: Record<string, string>) {
    this.verifySignature(rawBody, headers);

    let payload: ReceivedWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as ReceivedWebhookPayload;
    } catch {
      this.logger.warn('Received inbound webhook with invalid JSON body');
      return { ignored: true };
    }

    if (payload.type !== 'email.received' || !payload.data?.email_id) {
      return { ignored: true };
    }

    const meta = payload.data;
    const emailId = meta.email_id as string;

    // The webhook only carries metadata; fetch the full email for the body.
    const email = await this.mailService.fetchReceivedEmail(emailId);

    const fromEmail = this.extractAddress(email.from ?? meta.from ?? '');
    const recipients = [
      ...(meta.to ?? []),
      ...(meta.received_for ?? []),
      ...(email.to ?? []),
    ];
    const threadToken = this.extractThreadToken(recipients);
    const subject = email.subject ?? meta.subject ?? '';
    const body = this.cleanBody(email.text, email.html);
    const messageId = meta.message_id ?? null;

    if (!body) {
      this.logger.warn(`Inbound email ${emailId} had no usable body`);
      return { ignored: true };
    }

    if (threadToken) {
      const matched = await this.feedbackService.addInboundReply({
        threadToken,
        body,
        emailMessageId: messageId,
      });
      if (matched) {
        this.logger.log(
          `Inbound email ${emailId} appended to thread ${matched.id}`,
        );
        return { matched: true, feedbackId: matched.id };
      }
      this.logger.warn(
        `Inbound email ${emailId} had token ${threadToken} but no matching thread`,
      );
    }

    if (!fromEmail) {
      this.logger.warn(`Inbound email ${emailId} had no sender address`);
      return { ignored: true };
    }

    const created = await this.feedbackService.createFromInboundEmail({
      fromEmail,
      subject,
      body,
      emailMessageId: messageId,
    });

    if (!created) {
      return { ignored: true };
    }

    this.logger.log(
      `Inbound email ${emailId} created new thread ${created.id}`,
    );
    return { created: true, feedbackId: created.id };
  }

  // Verifies the Svix-style signature Resend attaches to webhooks. Skipped
  // (with a warning) when no secret is configured, so local dev still works.
  private verifySignature(rawBody: string, headers: Record<string, string>) {
    const secret = this.config.get<string>('RESEND_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn(
        'RESEND_WEBHOOK_SECRET not set — skipping inbound webhook signature verification',
      );
      return;
    }

    const id = headers['svix-id'];
    const timestamp = headers['svix-timestamp'];
    const signature = headers['svix-signature'];
    if (!id || !timestamp || !signature) {
      throw new UnauthorizedException('Missing webhook signature headers');
    }

    const secretKey = secret.startsWith('whsec_')
      ? secret.slice('whsec_'.length)
      : secret;
    const secretBytes = Buffer.from(secretKey, 'base64');
    const signedContent = `${id}.${timestamp}.${rawBody}`;
    const expected = createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64');

    // The header may contain multiple space-separated `v1,<sig>` values.
    const passed = signature.split(' ').some((part) => {
      const sig = part.includes(',') ? part.split(',')[1] : part;
      return this.safeEqual(sig, expected);
    });

    if (!passed) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private safeEqual(a: string, b: string) {
    try {
      const bufA = Buffer.from(a);
      const bufB = Buffer.from(b);
      if (bufA.length !== bufB.length) return false;
      return timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }

  private extractThreadToken(addresses: string[]): string | null {
    for (const address of addresses) {
      const match = /reply\+([^@]+)@/i.exec(address ?? '');
      if (match?.[1]) {
        return match[1];
      }
    }
    return null;
  }

  private extractAddress(value: string): string {
    // Handles both "Name <a@b.com>" and bare "a@b.com".
    const angled = /<([^>]+)>/.exec(value);
    const raw = (angled?.[1] ?? value).trim().toLowerCase();
    return /.+@.+\..+/.test(raw) ? raw : '';
  }

  private cleanBody(text?: string, html?: string): string {
    let body = text?.trim();
    if (!body && html) {
      body = html
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .trim();
    }
    if (!body) return '';
    return this.stripQuotedReply(body);
  }

  // Best-effort trimming of quoted history so only the new reply text is kept.
  private stripQuotedReply(body: string): string {
    const lines = body.split(/\r?\n/);
    const markers = [
      /^\s*>/,
      /^\s*On .+wrote:\s*$/i,
      /^\s*-{2,}\s*Original Message\s*-{2,}/i,
      /^\s*_{5,}\s*$/,
      /^\s*ב(תאריך|יום).+כתב/,
      /^\s*From:\s.+/i,
    ];

    const cutIndex = lines.findIndex((line) =>
      markers.some((marker) => marker.test(line)),
    );

    const kept = cutIndex >= 0 ? lines.slice(0, cutIndex) : lines;
    return kept.join('\n').trim() || body.trim();
  }
}
