import { Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { AiProvider } from '../../common/constants';
import { GenerateImageParams, GenerateImageResult, ImageUsage } from '../ai.types';
import { BaseImageProvider } from './base.provider';

interface GoogleTokenPrices {
  input: number;
  textOutput: number;
  imageOutput: number;
}

// Google Gemini pricing, USD per 1M tokens (Paid Tier, Standard).
// Image output is billed as output tokens (e.g. a 1024x1024 image ≈ 1290
// tokens on 2.5 Flash Image). Input text/image share the same input price.
const GOOGLE_TOKEN_PRICES: Record<string, GoogleTokenPrices> = {
  'gemini-2.5-flash-image': { input: 0.3, textOutput: 2.5, imageOutput: 30 },
  'gemini-3.1-flash-image': { input: 0.5, textOutput: 3, imageOutput: 60 },
  'gemini-3-pro-image-preview': { input: 2, textOutput: 12, imageOutput: 120 },
};

export class GoogleProvider extends BaseImageProvider {
  private readonly logger = new Logger(GoogleProvider.name);

  private estimateCostUsd(model: string, usage?: ImageUsage): number {
    if (!usage) return 0;

    const prices =
      GOOGLE_TOKEN_PRICES[model] ?? GOOGLE_TOKEN_PRICES['gemini-2.5-flash-image'];

    const inputTokens = usage.input_tokens ?? 0;
    const outputImageTokens = usage.output_tokens_details?.image_tokens ?? 0;
    const outputTextTokens = usage.output_tokens_details?.text_tokens ?? 0;

    return (
      (inputTokens * prices.input +
        outputTextTokens * prices.textOutput +
        outputImageTokens * prices.imageOutput) /
      1_000_000
    );
  }

  async generate(params: GenerateImageParams): Promise<GenerateImageResult> {
    const key = this.config.get('GOOGLE_API_KEY');
    if (!key) {
      throw new Error('GOOGLE_API_KEY is not configured');
    }
    const ai = new GoogleGenAI({ apiKey: key });
    const model = params.model || 'gemini-2.5-flash-image';
    const refs = this.resolveReferenceImages(params);

    const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
    for (const refUrl of refs) {
      const { blob } = await this.fetchReferenceImage(refUrl);
      const imageBase64 = Buffer.from(await blob.arrayBuffer()).toString('base64');
      imageParts.push({ inlineData: { mimeType: blob.type || 'image/png', data: imageBase64 } });
    }

    const contents =
      imageParts.length > 0
        ? [{ role: 'user', parts: [...imageParts, { text: params.prompt }] }]
        : params.prompt;

    const imageConfig: { aspectRatio?: string; imageSize?: string } = {};
    if (params.size) imageConfig.aspectRatio = params.size;
    // Only the Pro model supports the 1K/2K/4K resolution tiers.
    if (params.resolution && model.includes('3-pro')) {
      imageConfig.imageSize = params.resolution;
    }

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        ...(Object.keys(imageConfig).length > 0 ? { imageConfig } : {}),
      },
    });

    const usage = this.extractUsage(response);
    const costUsd = this.estimateCostUsd(model, usage);
    this.logger.log(
      `Google generate (${model}, refs: ${imageParts.length}) — input: ${usage?.input_tokens ?? 'N/A'}, output: ${usage?.output_tokens ?? 'N/A'}, cost: $${costUsd.toFixed(5)}`,
    );
    return {
      imageUrl: this.extractImage(response),
      provider: AiProvider.GOOGLE,
      usage,
      costUsd,
    };
  }

  private extractUsage(response: {
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
      promptTokensDetails?: Array<{ modality?: string; tokenCount?: number }>;
      candidatesTokensDetails?: Array<{ modality?: string; tokenCount?: number }>;
    };
  }): ImageUsage | undefined {
    const meta = response.usageMetadata;
    if (!meta) return undefined;

    const inputDetails = this.sumModalityTokens(meta.promptTokensDetails);
    const outputDetails = this.sumModalityTokens(meta.candidatesTokensDetails);

    return {
      input_tokens: meta.promptTokenCount ?? 0,
      output_tokens: meta.candidatesTokenCount ?? 0,
      total_tokens: meta.totalTokenCount ?? 0,
      ...(inputDetails ? { input_tokens_details: inputDetails } : {}),
      ...(outputDetails ? { output_tokens_details: outputDetails } : {}),
    };
  }

  private sumModalityTokens(
    details?: Array<{ modality?: string; tokenCount?: number }>,
  ): { text_tokens?: number; image_tokens?: number } | undefined {
    if (!details?.length) return undefined;

    let textTokens = 0;
    let imageTokens = 0;
    for (const detail of details) {
      const tokens = detail.tokenCount ?? 0;
      if (detail.modality === 'IMAGE') imageTokens += tokens;
      else textTokens += tokens;
    }

    return { text_tokens: textTokens, image_tokens: imageTokens };
  }

  private extractImage(response: {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string }; text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
    usageMetadata?: unknown;
  }): string {
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    for (const part of parts) {
      if (part.inlineData?.data) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }

    const textParts = parts
      .map((p) => p.text)
      .filter((t): t is string => typeof t === 'string' && t.length > 0);
    const blockReason = response.promptFeedback?.blockReason;
    const finishReason = candidate?.finishReason;

    this.logger.error(
      `Google Gemini returned no image. blockReason=${blockReason ?? 'none'}, finishReason=${finishReason ?? 'none'}, text=${textParts.join(' | ') || 'none'}`,
    );

    if (blockReason) throw new Error(`Google Gemini blocked the request: ${blockReason}`);
    if (finishReason && finishReason !== 'STOP') {
      throw new Error(
        `Google Gemini finished without image (reason: ${finishReason})${textParts.length ? `: ${textParts.join(' ')}` : ''}`,
      );
    }
    if (textParts.length) throw new Error(`Google Gemini returned text instead of image: ${textParts.join(' ')}`);
    throw new Error('Google Gemini returned no image');
  }
}
