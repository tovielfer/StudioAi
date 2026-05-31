import { Logger } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { AiProvider } from '../../common/constants';
import { GenerateImageParams, GenerateImageResult, ImageUsage } from '../ai.types';
import { BaseImageProvider } from './base.provider';

export class GoogleProvider extends BaseImageProvider {
  private readonly logger = new Logger(GoogleProvider.name);

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

    const response = await ai.models.generateContent({
      model,
      contents,
      config: { responseModalities: ['TEXT', 'IMAGE'] },
    });

    const usage = this.extractUsage(response);
    this.logger.log(
      `Google generate (refs: ${imageParts.length}) — input: ${usage?.input_tokens ?? 'N/A'}, output: ${usage?.output_tokens ?? 'N/A'}`,
    );
    return { imageUrl: this.extractImage(response), provider: AiProvider.GOOGLE, usage };
  }

  private extractUsage(response: {
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  }): ImageUsage | undefined {
    const meta = response.usageMetadata;
    if (!meta) return undefined;
    return {
      input_tokens: meta.promptTokenCount ?? 0,
      output_tokens: meta.candidatesTokenCount ?? 0,
      total_tokens: meta.totalTokenCount ?? 0,
    };
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
