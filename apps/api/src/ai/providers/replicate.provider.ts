import { AiProvider } from '../../common/constants';
import { normalizeVideoDuration } from '../../common/model-capabilities';
import { GenerateImageParams, GenerateImageResult } from '../ai.types';
import { BaseImageProvider } from './base.provider';

type ReplicatePrediction = {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'canceled' | 'failed';
  output?: string | string[] | null;
  error?: string | null;
  urls?: { get?: string };
};

export class ReplicateProvider extends BaseImageProvider {
  async generate(params: GenerateImageParams): Promise<GenerateImageResult> {
    const token = this.config.get('REPLICATE_API_TOKEN');
    if (!token) throw new Error('REPLICATE_API_TOKEN is not configured');

    if (params.type === 'video' || params.model.startsWith('seedance')) {
      return this.generateVideo(params, token);
    }

    const model = params.model || 'black-forest-labs/flux-schnell';
    const { width, height } = this.dimensions(params.size, params.resolution);
    const firstRef = this.resolveReferenceImages(params)[0];

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      body: JSON.stringify({
        version: model.includes('/') ? undefined : model,
        model: model.includes('/') ? model : undefined,
        input: {
          prompt: params.prompt,
          width,
          height,
          ...(firstRef ? { image: firstRef } : {}),
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Replicate error: ${err}`);
    }

    const data = (await response.json()) as { output?: string | string[] };
    const output = Array.isArray(data.output) ? data.output[0] : data.output;
    if (!output) throw new Error('Replicate returned no output');

    return { imageUrl: output, provider: AiProvider.REPLICATE };
  }

  // Seedance 2.0 (and other long-running video models) cannot rely on the
  // synchronous `Prefer: wait` header — generation takes far longer than the
  // request timeout — so we submit and poll the prediction to completion.
  private async generateVideo(
    params: GenerateImageParams,
    token: string,
  ): Promise<GenerateImageResult> {
    const model = this.resolveVideoModel(params.model);
    const refs = this.resolveReferenceImages(params);
    const startImage = refs[0];
    const endImage = refs[1];
    const duration = normalizeVideoDuration(params.model, params.durationSeconds);

    const input: Record<string, unknown> = {
      prompt: params.prompt,
      duration,
      resolution: params.resolution ?? '720p',
      generate_audio: Boolean(params.generateAudio),
    };

    if (params.model === 'seedance-v2-ref') {
      // Reference-to-video: pass every uploaded image as a reference. They're
      // referenced in the prompt as [Image1], [Image2], … and are mutually
      // exclusive with first/last frame images, so we never send `image` here.
      const referenceImages = this.resolveReferenceImages(params);
      if (referenceImages.length) {
        input.reference_images = referenceImages;
      }
      input.aspect_ratio = this.aspectRatio(params.size);
    } else if (startImage) {
      // Image-to-video: the aspect ratio is derived from the first frame, so we
      // let the model adapt rather than forcing a (possibly conflicting) ratio.
      input.image = startImage;
      if (endImage) input.last_frame_image = endImage;
      input.aspect_ratio = 'adaptive';
    } else {
      input.aspect_ratio = this.aspectRatio(params.size);
    }

    // Official models are run via their model-specific endpoint, which uses the
    // latest version automatically — the generic /v1/predictions endpoint
    // requires a pinned `version` and rejects a top-level `model` field.
    const submit = await this.fetchJson<ReplicatePrediction>(
      `https://api.replicate.com/v1/models/${model}/predictions`,
      token,
      { method: 'POST', body: JSON.stringify({ input }) },
    );

    const statusUrl =
      submit.urls?.get ??
      `https://api.replicate.com/v1/predictions/${submit.id}`;

    const startedAt = Date.now();
    const timeoutMs = 10 * 60 * 1000;
    let prediction = submit;
    while (prediction.status !== 'succeeded') {
      if (prediction.status === 'failed' || prediction.status === 'canceled') {
        throw new Error(
          prediction.error ?? `Replicate prediction ${prediction.status}`,
        );
      }
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error('Replicate video generation timed out');
      }
      await this.delay(5000);
      prediction = await this.fetchJson<ReplicatePrediction>(statusUrl, token);
    }

    const videoUrl = Array.isArray(prediction.output)
      ? prediction.output[0]
      : prediction.output;
    if (!videoUrl) throw new Error('Replicate returned no video');

    return { imageUrl: videoUrl, provider: AiProvider.REPLICATE };
  }

  private resolveVideoModel(model: string): string {
    // Allow passing a fully-qualified replicate model slug straight through.
    if (model.includes('/')) return model;
    const map: Record<string, string> = {
      'seedance-v2': 'bytedance/seedance-2.0',
      'seedance-v2-ref': 'bytedance/seedance-2.0',
      'seedance-v2-fast': 'bytedance/seedance-2.0-fast',
      'seedance-v2-mini': 'bytedance/seedance-2.0-mini',
    };
    return map[model] ?? 'bytedance/seedance-2.0';
  }

  // Seedance 2.0 accepts a fixed set of aspect ratios for text-to-video.
  private aspectRatio(size: string): string {
    const allowed = new Set([
      '16:9',
      '4:3',
      '1:1',
      '3:4',
      '9:16',
      '21:9',
      '9:21',
    ]);
    return allowed.has(size) ? size : '16:9';
  }

  private async fetchJson<T>(
    url: string,
    token: string,
    options: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
      },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Replicate error: ${err}`);
    }

    return response.json() as Promise<T>;
  }
}
