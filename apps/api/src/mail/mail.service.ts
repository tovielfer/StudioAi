import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
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
  private transporter: Transporter | null = null;
  private mailFrom: string | null = null;

  constructor(private readonly config: ConfigService) {}

  // Lazily build the transporter so the app still boots when SMTP is not
  // configured; the error only surfaces when someone actually sends a mail.
  private getTransporter(): { transporter: Transporter; from: string } {
    if (this.transporter && this.mailFrom) {
      return { transporter: this.transporter, from: this.mailFrom };
    }

    const host = this.config.get<string>('SMTP_HOST');
    const port = this.config.get<string>('SMTP_PORT');
    const secure = this.config.get<string>('SMTP_SECURE');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('MAIL_FROM');

    const missing = Object.entries({
      SMTP_HOST: host,
      SMTP_PORT: port,
      SMTP_USER: user,
      SMTP_PASS: pass,
      MAIL_FROM: from,
    })
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      const message = `Mail is not configured: missing env variable(s) ${missing.join(', ')}`;
      this.logger.error(message);
      throw new Error(message);
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: secure === 'true',
      auth: { user, pass },
    });
    this.mailFrom = from as string;

    return { transporter: this.transporter, from: this.mailFrom };
  }

  async sendGenerationImage({
    to,
    generation,
  }: {
    to: string;
    generation: Generation;
  }): Promise<void> {
    const { transporter, from } = this.getTransporter();

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

    await transporter.sendMail({
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
