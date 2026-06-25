import { AiProvider } from '../../common/constants';
import { normalizeVideoDuration } from '../../common/model-capabilities';
import { GenerateImageParams, GenerateImageResult } from '../ai.types';
import { BaseImageProvider } from './base.provider';

type FalQueueSubmitResponse = {
  request_id: string;
  status_url?: string;
  response_url?: string;
};

type FalQueueStatusResponse = {
  status?: string;
  error?: string;
};

type FalResultFile = {
  url?: string;
};

type FalGenerationResponse = {
  images?: FalResultFile[];
  image?: FalResultFile;
  video?: FalResultFile;
  videos?: FalResultFile[];
  data?: FalGenerationResponse;
};

export class FalProvider extends BaseImageProvider {
  async generate(params: GenerateImageParams): Promise<GenerateImageResult> {
    const key = this.config.get('FAL_KEY');
    if (!key) throw new Error('FAL_KEY is not configured');

    if (params.type === 'video' || params.model.includes('kling-video')) {
      return this.generateVideo(params, key);
    }

    const endpoint = this.resolveEndpoint(params.model);
    const { width, height } = this.dimensions(params.size, params.resolution);
    const firstRef = this.resolveReferenceImages(params)[0];

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: params.prompt,
        image_size: { width, height },
        ...(firstRef ? { image_url: firstRef } : {}),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Fal.ai error: ${err}`);
    }

    const data = (await response.json()) as { images?: { url: string }[] };
    const imageUrl = data.images?.[0]?.url;
    if (!imageUrl) throw new Error('Fal.ai returned no image');

    return { imageUrl, provider: AiProvider.FAL };
  }

  private async generateVideo(
    params: GenerateImageParams,
    key: string,
  ): Promise<GenerateImageResult> {
    const refs = this.resolveReferenceImages(params);
    const startImage = refs[0];
    const endImage = refs[1];
    const endpointId = this.resolveVideoEndpoint(
      params.model,
      Boolean(startImage),
    );

    const isV3 = endpointId.includes('/v3/');
    const isImageToVideo = endpointId.endsWith('/image-to-video');
    const duration = normalizeVideoDuration(params.model, params.durationSeconds);

    const input: Record<string, unknown> = {
      prompt: params.prompt,
      duration: String(duration),
      negative_prompt: 'blur, distort, and low quality',
      cfg_scale: 0.5,
    };

    // v3 generates audio by default — always send the flag so "off" stays
    // silent (and cheaper). v2.1 has no audio support, so the flag is omitted.
    if (isV3) {
      input.generate_audio = Boolean(params.generateAudio);
    }

    // aspect_ratio is only honoured by text-to-video; for image-to-video the
    // ratio is derived from the start image and the field is rejected/ignored.
    if (!isImageToVideo) {
      input.aspect_ratio = this.klingAspectRatio(params.size);
    } else {
      Object.assign(input, this.klingImageFields(isV3, startImage, endImage));
    }

    const result = await this.runQueued(endpointId, key, input);

    const videoUrl =
      result.video?.url ??
      result.videos?.[0]?.url ??
      result.data?.video?.url ??
      result.data?.videos?.[0]?.url;

    if (!videoUrl) throw new Error('Fal.ai returned no video');
    return { imageUrl: videoUrl, provider: AiProvider.FAL };
  }

  private async runQueued(
    endpointId: string,
    key: string,
    input: Record<string, unknown>,
  ): Promise<FalGenerationResponse> {
    const submit = await this.fetchJson<FalQueueSubmitResponse>(
      `https://queue.fal.run/${endpointId}`,
      key,
      { method: 'POST', body: JSON.stringify(input) },
    );

    const statusUrl =
      submit.status_url ??
      `https://queue.fal.run/${endpointId}/requests/${submit.request_id}/status`;
    const responseUrl =
      submit.response_url ??
      `https://queue.fal.run/${endpointId}/requests/${submit.request_id}/response`;

    const startedAt = Date.now();
    const timeoutMs = 10 * 60 * 1000;
    while (Date.now() - startedAt < timeoutMs) {
      const status = await this.fetchJson<FalQueueStatusResponse>(statusUrl, key);
      if (status.status === 'COMPLETED') {
        return this.fetchJson<FalGenerationResponse>(responseUrl, key);
      }
      if (status.status === 'FAILED' || status.status === 'CANCELLED') {
        throw new Error(status.error ?? `Fal.ai queue ${status.status.toLowerCase()}`);
      }
      await this.delay(5000);
    }

    throw new Error('Fal.ai video generation timed out');
  }

  private async fetchJson<T>(
    url: string,
    key: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
      },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Fal.ai error: ${err}`);
    }

    return response.json() as Promise<T>;
  }

  // Maps a registry model id to its fal endpoint base. The mode (text/image
  // -to-video) is appended based on whether a start image was supplied.
  private static readonly KLING_ENDPOINT_BASE: Record<string, string> = {
    'kling-v3-standard': 'fal-ai/kling-video/v3/standard',
    'kling-v3-pro': 'fal-ai/kling-video/v3/pro',
    'kling-v2.1-master': 'fal-ai/kling-video/v2.1/master',
    'kling-v2.1-pro': 'fal-ai/kling-video/v2.1/pro',
    'kling-v2.1-standard': 'fal-ai/kling-video/v2.1/standard',
  };

  // v2.1 standard/pro only expose image-to-video on fal — they require a start
  // image and have no text-to-video endpoint.
  private static readonly IMAGE_ONLY_MODELS = new Set([
    'kling-v2.1-standard',
    'kling-v2.1-pro',
  ]);

  private resolveVideoEndpoint(model: string, hasReference: boolean): string {
    // Allow passing a fully-qualified endpoint straight through.
    if (model.includes('/text-to-video') || model.includes('/image-to-video')) {
      if (model.startsWith('fal-ai/')) return model;
      return model.replace(/^https:\/\/fal\.run\//, '');
    }

    const base =
      FalProvider.KLING_ENDPOINT_BASE[model] ??
      'fal-ai/kling-video/v3/standard';

    if (FalProvider.IMAGE_ONLY_MODELS.has(model)) {
      if (!hasReference) {
        throw new Error('מודל זה דורש תמונת התחלה ליצירת הסרטון');
      }
      return `${base}/image-to-video`;
    }

    return `${base}/${hasReference ? 'image-to-video' : 'text-to-video'}`;
  }

  // Image-to-video frame fields differ by Kling version: v3 uses
  // start_image_url/end_image_url, v2.1 uses image_url/tail_image_url.
  private klingImageFields(
    isV3: boolean,
    startImage?: string,
    endImage?: string,
  ): Record<string, string> {
    const fields: Record<string, string> = {};
    if (startImage) {
      fields[isV3 ? 'start_image_url' : 'image_url'] = startImage;
    }
    if (endImage) {
      fields[isV3 ? 'end_image_url' : 'tail_image_url'] = endImage;
    }
    return fields;
  }

  private klingAspectRatio(size: string): string {
    if (size === '9:16') return '9:16';
    if (size === '1:1') return '1:1';
    return '16:9';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private resolveEndpoint(model?: string): string {
    const defaults: Record<string, string> = {
      'fal-flux': 'https://fal.run/fal-ai/flux/schnell',
      'flux-schnell': 'https://fal.run/fal-ai/flux/schnell',
    };
    if (model?.startsWith('http')) return model;
    return defaults[model ?? ''] ?? 'https://fal.run/fal-ai/flux/schnell';
  }
}
