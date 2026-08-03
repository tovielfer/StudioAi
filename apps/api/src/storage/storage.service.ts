import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly storageType: string;
  private readonly localPath: string;
  private readonly apiUrl: string;

  constructor(private readonly config: ConfigService) {
    this.storageType = config.get('STORAGE_TYPE', 'local');
    this.localPath = config.get('LOCAL_STORAGE_PATH', './uploads');
    this.apiUrl = config.get('PUBLIC_API_URL', 'http://localhost:3001');
    this.bucket = config.get('R2_BUCKET', '');
    this.publicUrl = config.get('R2_PUBLIC_URL', '');

    const accountId = config.get('R2_ACCOUNT_ID');
    if (this.storageType === 'r2' && accountId) {
      const logger = this.logger;
      const s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.get('R2_ACCESS_KEY_ID', ''),
          secretAccessKey: config.get('R2_SECRET_ACCESS_KEY', ''),
        },
      });

      s3.middlewareStack.add(
        (next) => async (args) => {
          const result = await next(args).catch(async (err) => {
            const raw = (err as { $response?: { body?: unknown } })?.$response?.body;
            if (raw) {
              try {
                const chunks: Buffer[] = [];
                for await (const chunk of raw as AsyncIterable<Buffer>) {
                  chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }
                logger.error(`R2 raw error body: ${Buffer.concat(chunks).toString('utf-8')}`);
              } catch {
                logger.error(`R2 raw error body could not be read`);
              }
            }
            throw err;
          });
          return result;
        },
        { step: 'deserialize', name: 'r2ErrorLogger', priority: 'low' },
      );

      this.s3 = s3;
    } else {
      this.s3 = null;
    }
  }

  async uploadBuffer(
    buffer: Buffer,
    ext: string,
    contentType: string,
  ): Promise<string> {
    const key = `generations/${uuidv4()}.${ext}`;

    if (this.storageType === 'r2' && this.s3) {
      try {
        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
          }),
        );
      } catch (err) {
        const code =
          (err as Record<string, unknown>)?.Code ??
          (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode ??
          'unknown';
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `R2 upload failed (bucket=${this.bucket} key=${key} code=${code}): ${msg}`,
          err instanceof Error ? err.stack : undefined,
        );
        throw new Error(`R2 upload failed [${code}]: ${msg}`);
      }
      return `${this.publicUrl}/${key}`;
    }

    const fullPath = path.join(this.localPath, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    return `${this.apiUrl}/uploads/${key}`;
  }

  async uploadFromUrl(sourceUrl: string): Promise<string> {
    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch generated asset: ${response.statusText}. URL: ${sourceUrl}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/png';
      const ext = this.extensionForContentType(contentType, sourceUrl);
      return this.uploadBuffer(buffer, ext, contentType);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('Blocked by NetFree') && !msg.includes('URL:')) {
        throw new Error(`${msg}. URL: ${sourceUrl}`);
      }
      throw error;
    }
  }

  // Permanently removes a previously uploaded asset given its public URL.
  // Best-effort: a missing object (already gone) is treated as success, and any
  // other failure is logged and swallowed so callers can proceed with deleting
  // the owning DB row. Returns true when the object was deleted (or absent).
  async deleteByUrl(url: string | null | undefined): Promise<boolean> {
    if (!url) return false;

    const key = this.keyFromUrl(url);
    if (!key) {
      this.logger.warn(`Could not derive storage key from url: ${url}`);
      return false;
    }

    if (this.storageType === 'r2' && this.s3) {
      try {
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
        );
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`R2 delete failed (key=${key}): ${msg}`);
        return false;
      }
    }

    const fullPath = path.join(this.localPath, key);
    try {
      await fs.unlink(fullPath);
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return true;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Local delete failed (path=${fullPath}): ${msg}`);
      return false;
    }
  }

  // Extracts the storage key (e.g. `generations/<uuid>.png`) from a public URL,
  // handling both the R2 public-URL form and the local `/uploads/<key>` form.
  private keyFromUrl(url: string): string | null {
    if (this.publicUrl && url.startsWith(`${this.publicUrl}/`)) {
      return url.slice(this.publicUrl.length + 1);
    }

    const marker = '/uploads/';
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      return url.slice(idx + marker.length);
    }

    try {
      const pathname = new URL(url).pathname.replace(/^\/+/, '');
      return pathname || null;
    } catch {
      return null;
    }
  }

  private extensionForContentType(contentType: string, sourceUrl: string): string {
    if (contentType.includes('jpeg')) return 'jpg';
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('gif')) return 'gif';
    if (contentType.includes('mp4')) return 'mp4';
    if (contentType.includes('webm')) return 'webm';

    try {
      const ext = new URL(sourceUrl).pathname.split('.').pop()?.toLowerCase();
      if (ext && /^[a-z0-9]{2,5}$/.test(ext)) return ext;
    } catch {
      // fall back below
    }
    return 'bin';
  }

}
