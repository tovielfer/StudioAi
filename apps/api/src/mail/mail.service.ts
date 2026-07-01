import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
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
  private mailReplyTo: string | null = null;

  constructor(private readonly config: ConfigService) {}

  // Lazily build the Resend client so the app still boots when mail is not
  // configured; the error only surfaces when someone actually sends a mail.
  // We send over Resend's HTTP API (port 443) instead of SMTP, because most
  // cloud hosts (Railway, Render, Fly, etc.) block/throttle outbound SMTP
  // ports (25/465/587), which makes SMTP sends hang for a long time.
  private getClient(): {
    resend: Resend;
    from: string;
    replyTo: string | null;
  } {
    if (this.resend && this.mailFrom) {
      return {
        resend: this.resend,
        from: this.mailFrom,
        replyTo: this.mailReplyTo,
      };
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
    // Some hosting platforms don't strip surrounding quotes from env vars, so a
    // value like `"My App <noreply@example.com>"` reaches us with the quotes
    // intact, which Resend rejects as an invalid `from`. Normalize it here.
    this.mailFrom = this.sanitizeFrom(from as string);

    // Optional: where user replies should go. When unset, replies go to the
    // `from` address (e.g. a noreply inbox nobody reads).
    const replyTo = this.config.get<string>('MAIL_REPLY_TO');
    this.mailReplyTo = replyTo ? this.sanitizeFrom(replyTo) : null;

    return {
      resend: this.resend,
      from: this.mailFrom,
      replyTo: this.mailReplyTo,
    };
  }

  private sanitizeFrom(value: string): string {
    return value.trim().replace(/^["']+|["']+$/g, '').trim();
  }

  // Builds a thread-scoped reply address like
  // `reply+<threadToken>@inbound.vookapix.com` when an inbound domain is
  // configured. Returns null so callers can fall back to the default reply-to.
  private buildThreadReplyTo(threadToken?: string | null): string | null {
    const domainRaw = this.config.get<string>('MAIL_INBOUND_DOMAIN');
    if (!domainRaw || !threadToken) return null;
    const domain = this.sanitizeFrom(domainRaw).replace(/^@+/, '');
    return `reply+${threadToken}@${domain}`;
  }

  // Retrieves the full content of an inbound email that Resend received. The
  // `email.received` webhook only carries metadata, so the body/headers must
  // be fetched separately via the Receiving API using the email id.
  async fetchReceivedEmail(emailId: string): Promise<{
    from?: string;
    to?: string[];
    subject?: string;
    text?: string;
    html?: string;
    headers?: Record<string, string> | { name: string; value: string }[];
  }> {
    const apiKey =
      this.config.get<string>('RESEND_API_KEY') ??
      this.config.get<string>('SMTP_PASS');
    if (!apiKey) {
      throw new Error('Mail is not configured: missing RESEND_API_KEY');
    }

    const response = await fetch(
      `https://api.resend.com/emails/received/${emailId}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Failed to retrieve received email ${emailId} (${response.status}): ${detail}`,
      );
    }

    return (await response.json()) as {
      from?: string;
      to?: string[];
      subject?: string;
      text?: string;
      html?: string;
    };
  }

  async sendGenerationImage({
    to,
    generation,
  }: {
    to: string;
    generation: Generation;
  }): Promise<void> {
    const { resend, from, replyTo } = this.getClient();

    if (!generation.resultUrl) {
      throw new Error('Generation has no result URL to attach');
    }

    const response = await fetch(generation.resultUrl);
    if (!response.ok) {
      // 418 here is returned by the NetFree content filter when it blocks the
      // outbound request to the asset URL. Surface a clear message so the user
      // understands it's their network filter, not a bug in the app.
      if (response.status === 418) {
        throw new ServiceUnavailableException(
'הסרטון לא נבדק ע"י נטפרי, פתח בכרטיסיה ושלח לבדיקה'        );
      }
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
    const readyLabel = isVideo ? 'הסרטון מוכן' : 'התמונה מוכנה';
    const subject = isVideo ? 'הסרטון שיצרת מצורף 🎬' : 'התמונה שיצרת מצורפת 🖼️';

    const html = `
      <div style="background-color: #0f0f13; padding: 0; margin: 0; font-family: Arial, 'Segoe UI', sans-serif;">
        <div style="max-width: 560px; margin: 0 auto; padding: 32px 24px;">
          <!-- Header / Logo -->
          <div dir="rtl" style="text-align: right; margin-bottom: 28px;">
            <span style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">vooka</span><span style="font-size: 22px; font-weight: 700; color: #a78bfa;">Pix</span>
          </div>

          <!-- Card -->
          <div dir="rtl" style="background: #1a1a24; border: 1px solid #2d2d3d; border-radius: 16px; padding: 28px 24px; text-align: right; line-height: 1.7; color: #e5e7eb;">
            <h2 style="margin: 0 0 12px; font-size: 20px; color: #ffffff;">${readyLabel}! ✨</h2>
            <p style="margin: 0 0 8px; color: #d1d5db;">צירפנו את ${assetLabel} למייל הזה כקובץ.</p>
            <p style="margin: 0 0 16px; color: #9ca3af; font-size: 14px;">
              <strong style="color: #c4b5fd;">תיאור:</strong> ${this.escapeHtml(generation.prompt)}
            </p>
            <div style="border-top: 1px solid #2d2d3d; padding-top: 16px; margin-top: 8px;">
              <p style="margin: 0; color: #6b7280; font-size: 13px;">תודה שבחרת ב‑<strong style="color: #a78bfa;">vookaPix</strong> 🙏</p>
            </div>
          </div>

          <!-- Footer -->
          <p style="text-align: center; margin-top: 20px; color: #4b5563; font-size: 12px;">
            © ${new Date().getFullYear()} vookaPix · כל הזכויות שמורות
          </p>
        </div>
      </div>
    `;

    const text = `${readyLabel}!\n\nצירפנו את ${assetLabel} למייל הזה כקובץ.\n\nתיאור: ${generation.prompt}\n\nתודה שבחרת ב-vookaPix.`;

    const { error } = await resend.emails.send({
      from,
      to,
      ...(replyTo ? { replyTo } : {}),
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

  async sendFeedbackReply({
    to,
    feedbackTitle,
    feedbackMessage,
    adminReply,
    threadToken,
  }: {
    to: string;
    feedbackTitle: string;
    feedbackMessage: string;
    adminReply: string;
    threadToken?: string | null;
  }): Promise<void> {
    const { resend, from, replyTo: defaultReplyTo } = this.getClient();
    // Prefer a thread-scoped reply address so the recipient's reply comes back
    // into this exact conversation via the inbound webhook.
    const replyTo = this.buildThreadReplyTo(threadToken) ?? defaultReplyTo;

    // Use FRONTEND_URL (the var actually set in env), matching auth.service.
    // Without an absolute base, email clients turn "/feedback" into the invalid
    // "http:///feedback" link. Strip any trailing slash to avoid "//feedback".
    const frontendUrl = (
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    ).replace(/\/+$/, '');
    const feedbackUrl = `${frontendUrl}/feedback`;

    const html = `
      <div style="background-color: #0f0f13; padding: 0; margin: 0; font-family: Arial, 'Segoe UI', sans-serif;">
        <div style="max-width: 560px; margin: 0 auto; padding: 32px 24px;">
          <div dir="rtl" style="text-align: right; margin-bottom: 28px;">
            <span style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">vooka</span><span style="font-size: 22px; font-weight: 700; color: #a78bfa;">Pix</span>
          </div>
          <div dir="rtl" style="background: #1a1a24; border: 1px solid #2d2d3d; border-radius: 16px; padding: 28px 24px; text-align: right; line-height: 1.7; color: #e5e7eb;">
            <h2 style="margin: 0 0 12px; font-size: 20px; color: #ffffff;">קיבלת תגובה לפניה שלך 💬</h2>
            <p style="margin: 0 0 8px; color: #9ca3af; font-size: 13px;">
              <strong style="color: #c4b5fd;">הפניה שלך:</strong> ${this.escapeHtml(feedbackTitle || feedbackMessage.slice(0, 80))}
            </p>
            <div style="background: #111118; border-right: 3px solid #7c3aed; border-radius: 8px; padding: 14px 16px; margin: 16px 0; color: #e5e7eb;">
              ${this.escapeHtml(adminReply).replace(/\n/g, '<br>')}
            </div>
            <div style="border-top: 1px solid #2d2d3d; padding-top: 16px; margin-top: 8px;">
              <p style="margin: 0; color: #6b7280; font-size: 13px;">תוכל לראות את כל הפניות שלך ב‑<a href="${feedbackUrl}" style="color: #a78bfa; text-decoration: none;">אזור הפניות</a>.</p>
            </div>
          </div>
          <p style="text-align: center; margin-top: 20px; color: #4b5563; font-size: 12px;">
            © ${new Date().getFullYear()} vookaPix · כל הזכויות שמורות
          </p>
        </div>
      </div>
    `;

    const text = `קיבלת תגובה לפניה שלך ב-vookaPix.\n\nהפניה: ${feedbackTitle || feedbackMessage.slice(0, 80)}\n\nתגובה:\n${adminReply}`;

    const { error } = await resend.emails.send({
      from,
      to,
      ...(replyTo ? { replyTo } : {}),
      subject: 'קיבלת תגובה לפניה שלך ב-vookaPix 💬',
      text,
      html,
    });

    if (error) {
      throw new Error(`Failed to send feedback reply email: ${error.message}`);
    }

    this.logger.log(`Sent feedback reply email to ${to}`);
  }

  // A general-purpose branded email an admin can send to a specific user from
  // the admin area. The message is plain text entered by the admin; we escape
  // it and preserve line breaks so it renders safely inside the HTML template.
  async sendCustomEmail({
    to,
    subject,
    message,
  }: {
    to: string;
    subject: string;
    message: string;
  }): Promise<void> {
    const { resend, from, replyTo } = this.getClient();

    const html = `
      <div style="background-color: #0f0f13; padding: 0; margin: 0; font-family: Arial, 'Segoe UI', sans-serif;">
        <div style="max-width: 560px; margin: 0 auto; padding: 32px 24px;">
          <div dir="rtl" style="text-align: right; margin-bottom: 28px;">
            <span style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">vooka</span><span style="font-size: 22px; font-weight: 700; color: #a78bfa;">Pix</span>
          </div>
          <div dir="rtl" style="background: #1a1a24; border: 1px solid #2d2d3d; border-radius: 16px; padding: 28px 24px; text-align: right; line-height: 1.7; color: #e5e7eb;">
            <h2 style="margin: 0 0 16px; font-size: 20px; color: #ffffff;">${this.escapeHtml(subject)}</h2>
            <div style="color: #d1d5db; font-size: 15px;">
              ${this.escapeHtml(message).replace(/\n/g, '<br>')}
            </div>
            <div style="border-top: 1px solid #2d2d3d; padding-top: 16px; margin-top: 20px;">
              <p style="margin: 0; color: #6b7280; font-size: 13px;">בברכה, צוות <strong style="color: #a78bfa;">vookaPix</strong> 🙏</p>
            </div>
          </div>
          <p style="text-align: center; margin-top: 20px; color: #4b5563; font-size: 12px;">
            © ${new Date().getFullYear()} vookaPix · כל הזכויות שמורות
          </p>
        </div>
      </div>
    `;

    const text = `${subject}\n\n${message}\n\nבברכה, צוות vookaPix`;

    const { error } = await resend.emails.send({
      from,
      to,
      ...(replyTo ? { replyTo } : {}),
      subject,
      text,
      html,
    });

    if (error) {
      throw new Error(`Failed to send custom email: ${error.message}`);
    }

    this.logger.log(`Sent custom email to ${to}`);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async sendEmailVerification({
    to,
    verifyUrl,
  }: {
    to: string;
    verifyUrl: string;
  }): Promise<void> {
    const { resend, from, replyTo } = this.getClient();

    const html = `
      <div style="background-color: #0f0f13; padding: 0; margin: 0; font-family: Arial, 'Segoe UI', sans-serif;">
        <div style="max-width: 560px; margin: 0 auto; padding: 32px 24px;">
          <div dir="rtl" style="text-align: right; margin-bottom: 28px;">
            <span style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">vooka</span><span style="font-size: 22px; font-weight: 700; color: #a78bfa;">Pix</span>
          </div>
          <div dir="rtl" style="background: #1a1a24; border: 1px solid #2d2d3d; border-radius: 16px; padding: 28px 24px; text-align: right; line-height: 1.7; color: #e5e7eb;">
            <h2 style="margin: 0 0 12px; font-size: 20px; color: #ffffff;">אימות כתובת המייל שלך ✉️</h2>
            <p style="margin: 0 0 16px; color: #d1d5db;">לחץ על הכפתור כדי לאמת את הכתובת ולהתחיל ליצור:</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${verifyUrl}" style="display: inline-block; background: #7c3aed; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600;">אמת את המייל</a>
            </div>
            <p style="margin: 0; color: #6b7280; font-size: 13px;">הקישור תקף ל-24 שעות. אם לא נרשמת אצלנו, תוכל להתעלם מהמייל הזה.</p>
          </div>
          <p style="text-align: center; margin-top: 20px; color: #4b5563; font-size: 12px;">
            © ${new Date().getFullYear()} vookaPix · כל הזכויות שמורות
          </p>
        </div>
      </div>
    `;

    const text = `אמת את המייל שלך ב-vookaPix:\n\n${verifyUrl}\n\nהקישור תקף ל-24 שעות.`;

    const { error } = await resend.emails.send({
      from,
      to,
      ...(replyTo ? { replyTo } : {}),
      subject: 'אמת את המייל שלך ב-vookaPix ✉️',
      text,
      html,
    });

    if (error) {
      throw new Error(`Failed to send verification email: ${error.message}`);
    }

    this.logger.log(`Sent verification email to ${to}`);
  }

  async sendPasswordReset({
    to,
    resetUrl,
  }: {
    to: string;
    resetUrl: string;
  }): Promise<void> {
    const { resend, from, replyTo } = this.getClient();

    const html = `
      <div style="background-color: #0f0f13; padding: 0; margin: 0; font-family: Arial, 'Segoe UI', sans-serif;">
        <div style="max-width: 560px; margin: 0 auto; padding: 32px 24px;">
          <div dir="rtl" style="text-align: right; margin-bottom: 28px;">
            <span style="font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">vooka</span><span style="font-size: 22px; font-weight: 700; color: #a78bfa;">Pix</span>
          </div>
          <div dir="rtl" style="background: #1a1a24; border: 1px solid #2d2d3d; border-radius: 16px; padding: 28px 24px; text-align: right; line-height: 1.7; color: #e5e7eb;">
            <h2 style="margin: 0 0 12px; font-size: 20px; color: #ffffff;">איפוס סיסמה 🔑</h2>
            <p style="margin: 0 0 16px; color: #d1d5db;">קיבלנו בקשה לאיפוס הסיסמה שלך. לחץ על הכפתור להגדרת סיסמה חדשה:</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${resetUrl}" style="display: inline-block; background: #7c3aed; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 600;">איפוס סיסמה</a>
            </div>
            <p style="margin: 0; color: #6b7280; font-size: 13px;">הקישור תקף לשעה אחת. אם לא ביקשת לאפס סיסמה, אפשר להתעלם מהמייל הזה.</p>
          </div>
          <p style="text-align: center; margin-top: 20px; color: #4b5563; font-size: 12px;">
            © ${new Date().getFullYear()} vookaPix · כל הזכויות שמורות
          </p>
        </div>
      </div>
    `;

    const text = `איפוס סיסמה ב-vookaPix:\n\n${resetUrl}\n\nהקישור תקף לשעה אחת.`;

    const { error } = await resend.emails.send({
      from,
      to,
      ...(replyTo ? { replyTo } : {}),
      subject: 'איפוס סיסמה ב-vookaPix 🔑',
      text,
      html,
    });

    if (error) {
      throw new Error(`Failed to send password reset email: ${error.message}`);
    }

    this.logger.log(`Sent password reset email to ${to}`);
  }
}
