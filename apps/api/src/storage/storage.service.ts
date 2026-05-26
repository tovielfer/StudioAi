import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
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
      this.s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.get('R2_ACCESS_KEY_ID', ''),
          secretAccessKey: config.get('R2_SECRET_ACCESS_KEY', ''),
        },
      });
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
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      return `${this.publicUrl}/${key}`;
    }

    const fullPath = path.join(this.localPath, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    return `${this.apiUrl}/uploads/${key}`;
  }

  async uploadFromUrl(sourceUrl: string): Promise<string> {
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/png';
    const ext = contentType.includes('jpeg') ? 'jpg' : 'png';
    return this.uploadBuffer(buffer, ext, contentType);
  }

  getLocalStoragePath() {
    return this.localPath;
  }
}
