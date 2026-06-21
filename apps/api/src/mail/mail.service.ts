import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { Generation } from '../generations/generation.entity';

// Maps a response content-type to a file extension for the attachment name.
const CONTENT_TYPE_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend: Resend | null = null;
  private mailFrom: string | null = null;

  constructor(private readonly config: ConfigService) {}

  // Lazily build the Resend client so the app still boots when mail is not
  // configured; the error only surfaces when someone actually sends a mail.
  // We send over Resend's HTTP API (port 443) instead of SMTP, because most
  // cloud hosts (Railway, Render, Fly, etc.) block/throttle outbound SMTP
  // ports (25/465/587), which makes SMTP sends hang for a long time.
  private getClient(): { resend: Resend; from: string } {
    if (this.resend && this.mailFrom) {
      return { resend: this.resend, from: this.mailFrom };
    }

    // Prefer RESEND_API_KEY, but fall back to the legacy SMTP_PASS, which on
    // Resend was already the API key (user "resend" / pass "re_...").
    const apiKey =
      this.config.get<string>('RESEND_API_KEY') ??
      this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('MAIL_FROM');

    const missing = Object.entries({
      RESEND_API_KEY: apiKey,
      MAIL_FROM: from,
    })
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      const message = `Mail is not configured: missing env variable(s) ${missing.join(', ')}`;
      this.logger.error(message);
      throw new Error(message);
    }

    this.resend = new Resend(apiKey as string);
    this.mailFrom = from as string;

    return { resend: this.resend, from: this.mailFrom };
  }

  async sendGenerationImage({
    to,
    generation,
  }: {
    to: string;
    generation: Generation;
  }): Promise<void> {
    const { resend, from } = this.getClient();

    if (!generation.resultUrl) {
      throw new Error('Generation has no result URL to attach');
    }

    const response = await fetch(generation.resultUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download asset (${response.status} ${response.statusText})`,
      );
    }

    const contentType =
      response.headers.get('content-type')?.split(';')[0].trim() ?? '';
    const ext = CONTENT_TYPE_EXT[contentType] ?? 'png';
    const buffer = Buffer.from(await response.arrayBuffer());

    const isVideo = generation.type === 'video';
    const assetLabel = isVideo ? 'הסרטון' : 'התמונה';
    const subject = isVideo ? 'הסרטון שיצרת מצורף 🎬' : 'התמונה שיצרת מצורפת 🖼️';

    const html = `
      <div dir="rtl" style="font-family: Arial, 'Segoe UI', sans-serif; text-align: right; line-height: 1.7; color: #1f2937;">
        <h2 style="margin: 0 0 12px;">${assetLabel} שלך מוכן/ה!</h2>
        <p style="margin: 0 0 8px;">צירפנו את ${assetLabel} למייל הזה כקובץ.</p>
        <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px;">
          <strong>תיאור:</strong> ${this.escapeHtml(generation.prompt)}
        </p>
        <p style="margin: 16px 0 0; color: #9ca3af; font-size: 12px;">תודה שהשתמשת בשירות שלנו 🙏</p>
      </div>
    `;

    const text = `${assetLabel} שלך מוכן/ה!\n\nצירפנו את ${assetLabel} למייל הזה כקובץ.\n\nתיאור: ${generation.prompt}\n\nתודה שהשתמשת בשירות שלנו.`;

    const { error } = await resend.emails.send({
      from,
      to,
      subject,
      text,
      html,
      attachments: [
        {
          filename: `generation-${generation.id}.${ext}`,
          content: buffer,
          contentType: contentType || 'application/octet-stream',
        },
      ],
    });

    if (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }

    this.logger.log(`Sent generation ${generation.id} to ${to}`);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
