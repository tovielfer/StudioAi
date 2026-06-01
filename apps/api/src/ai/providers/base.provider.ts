import { ConfigService } from '@nestjs/config';
import { GenerateImageParams, GenerateImageResult } from '../ai.types';

export abstract class BaseImageProvider {
  constructor(protected readonly config: ConfigService) {}

  abstract generate(params: GenerateImageParams): Promise<GenerateImageResult>;

  // Pixel dimensions for a given aspect ratio at 1K, scaled by the resolution tier.
  protected dimensions(
    ratio: string,
    resolution?: string,
  ): { width: number; height: number } {
    const base: Record<string, { width: number; height: number }> = {
      '1:1': { width: 1024, height: 1024 },
      '16:9': { width: 1344, height: 768 },
      '9:16': { width: 768, height: 1344 },
      '4:3': { width: 1152, height: 896 },
    };
    const factor: Record<string, number> = { '1K': 1, '2K': 2, '4K': 4 };
    const { width, height } = base[ratio] ?? base['1:1'];
    const scale = factor[resolution ?? '1K'] ?? 1;
    return { width: width * scale, height: height * scale };
  }

  protected resolveReferenceImages(params: GenerateImageParams): string[] {
    return params.referenceImages?.length ? params.referenceImages : [];
  }

  private static readonly REFERENCE_IMAGE_TIMEOUT_MS = 10_000;
  private static readonly REFERENCE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

  protected async fetchReferenceImage(url: string): Promise<{ blob: Blob; filename: string }> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('Invalid reference image URL');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`Unsupported reference image protocol: ${parsed.protocol}`);
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      BaseImageProvider.REFERENCE_IMAGE_TIMEOUT_MS,
    );
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Failed to fetch reference image: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > BaseImageProvider.REFERENCE_IMAGE_MAX_BYTES) {
        throw new Error('Reference image exceeds maximum allowed size');
      }
      const raw = response.headers.get('content-type') ?? '';
      // R2 (and some CDNs) may return application/octet-stream — fall back to URL extension
      const contentType = raw.startsWith('image/')
        ? raw.split(';')[0].trim()
        : this.contentTypeFromUrl(url);
      const blob = new Blob([buffer], { type: contentType });
      const filename = this.filenameFromUrl(url, contentType);
      return { blob, filename };
    } finally {
      clearTimeout(timeout);
    }
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
