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
  // `reply+<threadToken>@inbound.vookapix.com` so replies flow back into the
  // conversation. Gated behind MAIL_INBOUND_ENABLED so we can keep the whole
  // feature in place but temporarily route replies to the normal inbox
  // (MAIL_REPLY_TO) until inbound receiving is fully wired up. Returns null so
  // callers fall back to the default reply-to.
  private buildThreadReplyTo(threadToken?: string | null): string | null {
    const enabled = this.config.get<string>('MAIL_INBOUND_ENABLED') === 'true';
    const domainRaw = this.config.get<string>('MAIL_INBOUND_DOMAIN');
    if (!enabled || !domainRaw || !threadToken) return null;
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
    const accent = '#7c3aed';

    const html = this.renderEmail({
      accent,
      icon: '✨',
      heading: `${readyLabel}!`,
      bodyHtml: `
            <p style="margin: 0 0 12px; color: #374151;">צירפנו את ${assetLabel} למייל הזה כקובץ.</p>
            <p style="margin: 0 0 4px; color: #6b7280; font-size: 14px;"><strong style="color: ${accent};">תיאור:</strong> ${this.escapeHtml(generation.prompt)}</p>`,
      cta: { label: 'ליצירה נוספת', url: `${this.siteUrl()}/create` },
    });

    const text = `${readyLabel}!\n\nצירפנו את ${assetLabel} למייל הזה כקובץ.\n\nתיאור: ${generation.prompt}${this.buildFooterText()}`;

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
    const accent = '#2563eb';

    const html = this.renderEmail({
      accent,
      icon: '💬',
      heading: 'קיבלת תגובה לפנייה שלך',
      bodyHtml: `
            <p style="margin: 0 0 12px; color: #6b7280; font-size: 13px;"><strong style="color: ${accent};">הפנייה שלך:</strong> ${this.escapeHtml(feedbackTitle || feedbackMessage.slice(0, 80))}</p>
            <div style="background: #f3f6fd; border-right: 3px solid ${accent}; border-radius: 8px; padding: 14px 16px; margin: 8px 0; color: #374151;">
              ${this.escapeHtml(adminReply).replace(/\n/g, '<br>')}
            </div>`,
      cta: { label: 'לצפייה בפניות שלך', url: feedbackUrl },
    });

    const text = `קיבלת תגובה לפנייה שלך ב-vookaPix.\n\nהפנייה: ${feedbackTitle || feedbackMessage.slice(0, 80)}\n\nתגובה:\n${adminReply}${this.buildFooterText()}`;

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

  // Notifies the admin inbox (MAIL_REPLY_TO, falling back to MAIL_FROM) that a
  // new feedback/inquiry was submitted. Fire-and-forget by convention: callers
  // wrap this so a mail failure never blocks saving the submission. When no
  // recipient is configured we log and return instead of throwing.
  async sendNewFeedbackNotification({
    feedbackTitle,
    feedbackMessage,
    feedbackType,
    senderEmail,
    submissionId,
    isReply = false,
  }: {
    feedbackTitle: string;
    feedbackMessage: string;
    feedbackType?: string | null;
    senderEmail?: string | null;
    submissionId?: string | null;
    isReply?: boolean;
  }): Promise<void> {
    const { resend, from } = this.getClient();

    // Prefer the reply-to inbox (a real address the admin reads); fall back to
    // the from address so a notification still goes somewhere useful.
    const replyTo = this.config.get<string>('MAIL_REPLY_TO');
    const to = replyTo ? this.sanitizeFrom(replyTo) : from;
    if (!to) {
      this.logger.warn(
        'Skipping new-feedback notification: no MAIL_REPLY_TO/MAIL_FROM configured',
      );
      return;
    }

    const frontendUrl = (
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    ).replace(/\/+$/, '');
    const adminUrl = `${frontendUrl}/admin/feedback`;

    const typeLabels: Record<string, string> = {
      request: 'פנייה',
      note: 'הערה',
      improvement: 'שיפור',
      shortcut: 'קיצור דרך',
      other: 'אחר',
      email: 'מייל',
    };
    const typeLabel = feedbackType
      ? typeLabels[feedbackType] ?? feedbackType
      : null;

    const accent = '#ea580c';
    const senderLine = senderEmail
      ? `<p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;"><strong style="color: ${accent};">מאת:</strong> ${this.escapeHtml(senderEmail)}</p>`
      : '';
    const typeLine = typeLabel
      ? `<p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;"><strong style="color: ${accent};">סוג:</strong> ${this.escapeHtml(typeLabel)}</p>`
      : '';

    const heading = isReply ? 'תגובה חדשה לפנייה' : 'פנייה חדשה התקבלה';
    const subjectPrefix = isReply ? 'תגובה חדשה לפנייה' : 'פנייה חדשה התקבלה';
    // Set reply-to to the sender's own address so the admin can just hit
    // "Reply" in their mail client and answer the user directly.
    const replyToSender = senderEmail ? this.sanitizeFrom(senderEmail) : null;

    const html = this.renderEmail({
      accent,
      icon: isReply ? '💬' : '📨',
      heading,
      bodyHtml: `
            <p style="margin: 0 0 8px; color: #374151;"><strong style="color: ${accent};">כותרת:</strong> ${this.escapeHtml(feedbackTitle || '(ללא כותרת)')}</p>
            ${senderLine}
            ${typeLine}
            <div style="background: #fff7ed; border-right: 3px solid ${accent}; border-radius: 8px; padding: 14px 16px; margin: 12px 0; color: #374151;">
              ${this.escapeHtml(feedbackMessage).replace(/\n/g, '<br>')}
            </div>`,
      cta: { label: 'פתיחת הפנייה בניהול', url: adminUrl },
    });

    const text = `${subjectPrefix} ב-vookaPix.\n\nכותרת: ${feedbackTitle || '(ללא כותרת)'}${
      senderEmail ? `\nמאת: ${senderEmail}` : ''
    }${typeLabel ? `\nסוג: ${typeLabel}` : ''}\n\n${feedbackMessage}\n\nניהול: ${adminUrl}${this.buildFooterText()}`;

    const { error } = await resend.emails.send({
      from,
      to,
      ...(replyToSender ? { replyTo: replyToSender } : {}),
      subject: `${subjectPrefix} - ${feedbackTitle || '(ללא כותרת)'}`,
      text,
      html,
    });

    if (error) {
      throw new Error(
        `Failed to send new-feedback notification email: ${error.message}`,
      );
    }

    this.logger.log(
      `Sent new-feedback notification to ${to}${submissionId ? ` (submission ${submissionId})` : ''}`,
    );
  }

  // Builds the branded HTML + plain-text body for an admin-authored message.
  // The message is plain text entered by the admin; we escape it and preserve
  // line breaks so it renders safely inside the HTML template. Shared by the
  // single-recipient custom email and the broadcast so both look identical.
  private buildCustomEmailContent(
    subject: string,
    message: string,
  ): { html: string; text: string } {
    const accent = '#7c3aed';
    const html = this.renderEmail({
      accent,
      icon: '🙏',
      heading: subject,
      bodyHtml: `
            <div style="color: #374151; font-size: 15px;">
              ${this.escapeHtml(message).replace(/\n/g, '<br>')}
            </div>
            <p style="margin: 20px 0 0; color: #6b7280; font-size: 13px;">בברכה, צוות <strong style="color: ${accent};">vookaPix</strong></p>`,
    });

    const text = `${subject}\n\n${message}\n\nבברכה, צוות vookaPix${this.buildFooterText()}`;

    return { html, text };
  }

  // A general-purpose branded email an admin can send to a specific user from
  // the admin area.
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
    const { html, text } = this.buildCustomEmailContent(subject, message);

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

  // Sends the same branded message to many recipients (an admin "broadcast").
  // Each recipient gets their own email (one address per message) so nobody
  // sees anyone else's address. We use Resend's batch API (up to 100 messages
  // per request) to stay well within rate limits, and process batches
  // sequentially so a large audience doesn't fire hundreds of requests at once.
  // Returns per-recipient success/failure counts so the caller can report a
  // partial send instead of failing the whole operation on one bad address.
  async sendBroadcast({
    recipients,
    subject,
    message,
  }: {
    recipients: string[];
    subject: string;
    message: string;
  }): Promise<{ sent: number; failed: number }> {
    const { resend, from, replyTo } = this.getClient();
    const { html, text } = this.buildCustomEmailContent(subject, message);

    const BATCH_SIZE = 100;
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const chunk = recipients.slice(i, i + BATCH_SIZE);
      const payload = chunk.map((to) => ({
        from,
        to,
        ...(replyTo ? { replyTo } : {}),
        subject,
        text,
        html,
      }));

      try {
        const { error } = await resend.batch.send(payload);
        if (error) {
          failed += chunk.length;
          this.logger.error(
            `Broadcast batch (${chunk.length} recipients) failed: ${error.message}`,
          );
        } else {
          sent += chunk.length;
        }
      } catch (err) {
        failed += chunk.length;
        this.logger.error(
          `Broadcast batch (${chunk.length} recipients) threw: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    this.logger.log(
      `Broadcast complete: ${sent} sent, ${failed} failed (of ${recipients.length})`,
    );

    return { sent, failed };
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // The absolute base URL of the site. Email clients turn a relative "/foo"
  // into an invalid "http:///foo", so links and image sources must be
  // absolute. Falls back to localhost for local dev; strips trailing slashes.
  private siteUrl(): string {
    return (
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    ).replace(/\/+$/, '');
  }

  // The logo is served from the web app's public folder. Referencing it as a
  // hosted URL (instead of an attachment) means updating the site logo also
  // updates every future email automatically.
  private logoUrl(): string {
    return `${this.siteUrl()}/logo.png`;
  }

  // Shared branded wrapper for every outgoing email. A light, modern layout:
  // light-gray canvas, a white rounded card, a dark header band that holds the
  // logo (the logo image has a baked-in dark background, so a matching band
  // keeps it seamless), a per-email accent color/icon for light differentiation
  // between mail types, and a unified footer that invites the user to reply or
  // visit the site. Uses inline styles only, as required by email clients.
  private renderEmail(opts: {
    accent: string;
    heading: string;
    bodyHtml: string;
    icon?: string;
    cta?: { label: string; url: string };
  }): string {
    const { accent, heading, bodyHtml, icon, cta } = opts;
    const site = this.siteUrl();
    const logo = this.logoUrl();
    const year = new Date().getFullYear();

    const iconHtml = icon
      ? `<span style="margin-left: 8px;">${icon}</span>`
      : '';

    const ctaHtml = cta
      ? `
            <div style="text-align: center; margin: 28px 0 4px;">
              <a href="${cta.url}" style="display: inline-block; background: ${accent}; color: #ffffff; text-decoration: none; padding: 13px 30px; border-radius: 10px; font-size: 15px; font-weight: 600;">${cta.label}</a>
            </div>`
      : '';

    return `
      <div style="background-color: #f4f4f7; padding: 32px 16px; margin: 0; font-family: Arial, 'Segoe UI', sans-serif;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 6px 28px rgba(17, 24, 39, 0.08);">
          <!-- Header band with logo -->
          <div style="background: #0f0f13; border-top: 4px solid ${accent}; padding: 24px; text-align: center;">
            <a href="${site}" style="text-decoration: none;">
              <img src="${logo}" alt="vookaPix" width="150" style="display: inline-block; width: 150px; max-width: 55%; height: auto; border: 0;" />
            </a>
          </div>
          <!-- Body -->
          <div dir="rtl" style="padding: 32px 28px; text-align: right; line-height: 1.75; color: #374151;">
            <h2 style="margin: 0 0 16px; font-size: 21px; color: #111827;">${heading}${iconHtml}</h2>
            ${bodyHtml}${ctaHtml}
          </div>
          <!-- Footer -->
          <div dir="rtl" style="border-top: 1px solid #ececf1; padding: 22px 28px; text-align: center; color: #6b7280; font-size: 13px; line-height: 1.7;">
            <p style="margin: 0 0 6px;">אפשר להשיב ישירות למייל הזה, או <a href="${site}" style="color: ${accent}; text-decoration: none; font-weight: 600;">להיכנס לאתר</a>.</p>
            <p style="margin: 0; color: #9ca3af; font-size: 12px;">© ${year} vookaPix · כל הזכויות שמורות</p>
          </div>
        </div>
      </div>
    `;
  }

  // Unified sign-off lines appended to every plain-text email body, mirroring
  // the HTML footer.
  private buildFooterText(): string {
    return `\n\nאפשר להשיב ישירות למייל הזה, או להיכנס לאתר: ${this.siteUrl()}\n© ${new Date().getFullYear()} vookaPix · כל הזכויות שמורות`;
  }

  async sendEmailVerification({
    to,
    verifyUrl,
  }: {
    to: string;
    verifyUrl: string;
  }): Promise<void> {
    const { resend, from, replyTo } = this.getClient();

    const accent = '#16a34a';
    const html = this.renderEmail({
      accent,
      icon: '✉️',
      heading: 'אימות כתובת המייל שלך',
      bodyHtml: `
            <p style="margin: 0 0 4px; color: #374151;">לחץ על הכפתור כדי לאמת את הכתובת ולהתחיל ליצור:</p>
            <p style="margin: 16px 0 0; color: #6b7280; font-size: 13px;">הקישור תקף ל-24 שעות. אם לא נרשמת אצלנו, תוכל להתעלם מהמייל הזה.</p>`,
      cta: { label: 'אמת את המייל', url: verifyUrl },
    });

    const text = `אמת את המייל שלך ב-vookaPix:\n\n${verifyUrl}\n\nהקישור תקף ל-24 שעות.${this.buildFooterText()}`;

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

    const accent = '#d97706';
    const html = this.renderEmail({
      accent,
      icon: '🔑',
      heading: 'איפוס סיסמה',
      bodyHtml: `
            <p style="margin: 0 0 4px; color: #374151;">קיבלנו בקשה לאיפוס הסיסמה שלך. לחץ על הכפתור להגדרת סיסמה חדשה:</p>
            <p style="margin: 16px 0 0; color: #6b7280; font-size: 13px;">הקישור תקף לשעה אחת. אם לא ביקשת לאפס סיסמה, אפשר להתעלם מהמייל הזה.</p>`,
      cta: { label: 'איפוס סיסמה', url: resetUrl },
    });

    const text = `איפוס סיסמה ב-vookaPix:\n\n${resetUrl}\n\nהקישור תקף לשעה אחת.${this.buildFooterText()}`;

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
