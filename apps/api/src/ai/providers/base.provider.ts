import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { GenerateImageParams, GenerateImageResult } from '../ai.types';

export abstract class BaseImageProvider {
  private readonly baseLogger = new Logger('ReferenceImageFetch');

  constructor(protected readonly config: ConfigService) {}

  abstract generate(params: GenerateImageParams): Promise<GenerateImageResult>;

  // Pixel dimensions for a given aspect ratio at 1K, scaled by the resolution tier.
  protected dimensions(
    ratio: string,
    resolution?: string | null,
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
  // Google caps inline image data at 7MB; keep providers aligned with that.
  private static readonly REFERENCE_IMAGE_MAX_BYTES = 7 * 1024 * 1024;

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
      const rawHeader = response.headers.get('content-type') ?? '';
      const firstBytes = Array.from(new Uint8Array(buffer).slice(0, 4))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      // Trust the actual bytes over the header/extension: files are often stored
      // with a mismatched extension/content-type (e.g. a JPEG saved as .png),
      // which makes providers reject them with "invalid image file".
      const sniffed = this.detectImageContentType(buffer);
      const normalized = await this.normalizeReferenceImage(buffer);
      const normalizedBytes = new Uint8Array(normalized);
      const normalizedContentType = 'image/png';
      const blob = new Blob([normalizedBytes], { type: normalizedContentType });
      const filename = this.filenameFromContentType(normalizedContentType);
      this.baseLogger.log(
        `fetched ref: bytes=${buffer.byteLength}, normalized-bytes=${normalized.byteLength}, header-content-type="${rawHeader}", magic=[${firstBytes}], sniffed=${sniffed ?? 'null'}, final-content-type="${normalizedContentType}", filename="${filename}" (url=${url})`,
      );
      return { blob, filename };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async normalizeReferenceImage(buffer: ArrayBuffer): Promise<Buffer> {
    const normalized = await sharp(Buffer.from(buffer), { failOn: 'none' })
      .rotate()
      .toColorspace('srgb')
      .png()
      .toBuffer();

    if (normalized.byteLength > BaseImageProvider.REFERENCE_IMAGE_MAX_BYTES) {
      throw new Error('Reference image exceeds maximum allowed size after normalization');
    }

    return normalized;
  }

  // Identify the real image format from the file's magic bytes. Returns null
  // when the content isn't a recognized image so callers can fall back.
  private detectImageContentType(buffer: ArrayBuffer): string | null {
    const bytes = new Uint8Array(buffer);
    if (bytes.length < 12) return null;

    // JPEG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image/jpeg';
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return 'image/png';
    }
    // GIF: "GIF87a" / "GIF89a"
    if (
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38
    ) {
      return 'image/gif';
    }
    // WEBP: "RIFF"...."WEBP"
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return 'image/webp';
    }
    return null;
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

  private filenameFromContentType(contentType: string): string {
    return `reference.${this.extensionFromContentType(contentType)}`;
  }

  private extensionFromContentType(contentType: string): string {
    if (contentType.includes('jpeg')) return 'jpg';
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('gif')) return 'gif';
    if (contentType.includes('png')) return 'png';
    return 'png';
  }
}
