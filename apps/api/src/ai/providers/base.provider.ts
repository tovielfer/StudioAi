import { ConfigService } from '@nestjs/config';
import { GenerateImageParams, GenerateImageResult } from '../ai.types';

export abstract class BaseImageProvider {
  constructor(protected readonly config: ConfigService) {}

  abstract generate(params: GenerateImageParams): Promise<GenerateImageResult>;

  protected sizeToDimensions(size: string): { width: number; height: number } {
    const map: Record<string, { width: number; height: number }> = {
      '1:1': { width: 1024, height: 1024 },
      '16:9': { width: 1344, height: 768 },
      '9:16': { width: 768, height: 1344 },
      '4:3': { width: 1152, height: 896 },
    };
    return map[size] ?? map['1:1'];
  }

  protected resolveReferenceImages(params: GenerateImageParams): string[] {
    return params.referenceImages?.length ? params.referenceImages : [];
  }

  protected async fetchReferenceImage(url: string): Promise<{ blob: Blob; filename: string }> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch reference image: ${response.statusText}`);
    }
    const raw = response.headers.get('content-type') ?? '';
    // R2 (and some CDNs) may return application/octet-stream — fall back to URL extension
    const contentType = raw.startsWith('image/')
      ? raw.split(';')[0].trim()
      : this.contentTypeFromUrl(url);
    const blob = new Blob([await response.arrayBuffer()], { type: contentType });
    const filename = this.filenameFromUrl(url, contentType);
    return { blob, filename };
  }

  private contentTypeFromUrl(url: string): string {
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    return map[ext ?? ''] ?? 'image/png';
  }

  private filenameFromUrl(url: string, contentType: string): string {
    try {
      const filename = new URL(url).pathname.split('/').pop();
      if (filename?.includes('.')) return filename.toLowerCase();
    } catch {
      // fall through
    }
    return `reference.${this.extensionFromContentType(contentType)}`;
  }

  private extensionFromContentType(contentType: string): string {
    if (contentType.includes('jpeg')) return 'jpg';
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('png')) return 'png';
    return 'png';
  }
}
