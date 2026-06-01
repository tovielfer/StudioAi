import { Logger } from '@nestjs/common';
import { GenerationType } from '../common/constants';

const logger = new Logger('AiCostTable');

// USD cost per image, before margin
const IMAGE_COST_TABLE: Record<
  string,
  Record<string, Record<string, Record<string, number>>>
> = {
  openai: {
    'gpt-image-1': {
      '1:1':  { fast: 0.011, standard: 0.04,  hd: 0.167 },
      '16:9': { fast: 0.016, standard: 0.06,  hd: 0.25  },
      '9:16': { fast: 0.016, standard: 0.06,  hd: 0.25  },
      '4:3':  { fast: 0.016, standard: 0.06,  hd: 0.25  },
    },
    'gpt-image-2': {
      '1:1':  { fast: 0.015, standard: 0.05,  hd: 0.22  },
      '16:9': { fast: 0.015, standard: 0.05,  hd: 0.22  },
      '9:16': { fast: 0.015, standard: 0.05,  hd: 0.22  },
      '4:3':  { fast: 0.015, standard: 0.05,  hd: 0.22  },
    },
  },

  replicate: {
    'flux-dev': {
      '1:1':  { fast: 0.025, standard: 0.032, hd: 0.05 },
      '16:9': { fast: 0.03,  standard: 0.038, hd: 0.06 },
      '9:16': { fast: 0.03,  standard: 0.038, hd: 0.06 },
      '4:3':  { fast: 0.03,  standard: 0.038, hd: 0.06 },
    },
    'flux-schnell': {
      '1:1':  { fast: 0.003, standard: 0.003, hd: 0.003 },
      '16:9': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '9:16': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '4:3':  { fast: 0.003, standard: 0.003, hd: 0.003 },
    },
    'black-forest-labs/flux-schnell': {
      '1:1':  { fast: 0.003, standard: 0.003, hd: 0.003 },
      '16:9': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '9:16': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '4:3':  { fast: 0.003, standard: 0.003, hd: 0.003 },
    },
  },

  fal: {
    'flux-schnell': {
      '1:1':  { fast: 0.003, standard: 0.003, hd: 0.003 },
      '16:9': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '9:16': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '4:3':  { fast: 0.003, standard: 0.003, hd: 0.003 },
    },
    'fal-flux': {
      '1:1':  { fast: 0.003, standard: 0.003, hd: 0.003 },
      '16:9': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '9:16': { fast: 0.003, standard: 0.003, hd: 0.003 },
      '4:3':  { fast: 0.003, standard: 0.003, hd: 0.003 },
    },
  },

  stability: {
    'sd3': {
      '1:1':  { fast: 0.035, standard: 0.065, hd: 0.065 },
      '16:9': { fast: 0.035, standard: 0.065, hd: 0.065 },
      '9:16': { fast: 0.035, standard: 0.065, hd: 0.065 },
      '4:3':  { fast: 0.035, standard: 0.065, hd: 0.065 },
    },
  },

  google: {
    'gemini-3-pro-image-preview': {
      '1:1':  { fast: 0.134, standard: 0.134, hd: 0.134 },
      '16:9': { fast: 0.134, standard: 0.134, hd: 0.134 },
      '9:16': { fast: 0.134, standard: 0.134, hd: 0.134 },
      '4:3':  { fast: 0.134, standard: 0.134, hd: 0.134 },
    },
    'gemini-3.1-flash-image': {
      '1:1':  { fast: 0.0672, standard: 0.0672, hd: 0.0672 },
      '16:9': { fast: 0.0672, standard: 0.0672, hd: 0.0672 },
      '9:16': { fast: 0.0672, standard: 0.0672, hd: 0.0672 },
      '4:3':  { fast: 0.0672, standard: 0.0672, hd: 0.0672 },
    },
    'gemini-2.5-flash-image': {
      '1:1':  { fast: 0.039, standard: 0.039, hd: 0.039 },
      '16:9': { fast: 0.039, standard: 0.039, hd: 0.039 },
      '9:16': { fast: 0.039, standard: 0.039, hd: 0.039 },
      '4:3':  { fast: 0.039, standard: 0.039, hd: 0.039 },
    },
    'default': {
      '1:1':  { fast: 0.0672, standard: 0.0672, hd: 0.0672 },
      '16:9': { fast: 0.0672, standard: 0.0672, hd: 0.0672 },
      '9:16': { fast: 0.0672, standard: 0.0672, hd: 0.0672 },
      '4:3':  { fast: 0.0672, standard: 0.0672, hd: 0.0672 },
    },
  },

  mock: {
    default: {
      '1:1':  { fast: 0, standard: 0, hd: 0 },
      '16:9': { fast: 0, standard: 0, hd: 0 },
      '9:16': { fast: 0, standard: 0, hd: 0 },
      '4:3':  { fast: 0, standard: 0, hd: 0 },
    },
  },
};

// Multipliers applied to the base (~1K) cost for models whose price scales with
// output resolution. Composes with the per-quality base price. Models absent
// here are unaffected by resolution. Values are approximate; the real provider
// cost is reconciled from token usage at generation time.
const RESOLUTION_MULTIPLIER: Record<
  string,
  Record<string, Record<string, number>>
> = {
  google: {
    // Nano Banana Pro: 1K/2K priced the same (~$0.134), 4K ~$0.24.
    'gemini-3-pro-image-preview': { '1K': 1, '2K': 1, '4K': 1.79 },
  },
  openai: {
    // gpt-image-2 output tokens scale roughly with pixel count.
    'gpt-image-2': { '1K': 1, '2K': 4, '4K': 8 },
  },
};

// Markup applied on top of raw provider cost
const MARGIN = 2.5;

// Flat credit costs for non-image generation types
const FLAT_CREDIT_COSTS: Partial<Record<GenerationType, number>> = {
  [GenerationType.VIDEO]: 50,
  [GenerationType.UPSCALE]: 10,
};

const REFERENCE_IMAGE_USD = 0.005;
const FALLBACK_USD = 0.04;

function lookupUsdCost(
  provider: string,
  model: string,
  size: string,
  quality: string,
  resolution: string,
): number {
  const usd =
    IMAGE_COST_TABLE[provider]?.[model]?.[size]?.[quality] ??
    IMAGE_COST_TABLE[provider]?.['default']?.[size]?.[quality];

  if (usd === undefined) {
    logger.warn(
      `No cost entry for provider=${provider} model=${model} size=${size} quality=${quality} — using fallback $${FALLBACK_USD}`,
    );
    return FALLBACK_USD;
  }

  const multiplier = RESOLUTION_MULTIPLIER[provider]?.[model]?.[resolution] ?? 1;
  return usd * multiplier;
}

export interface GenerationCostParams {
  provider: string;
  model: string;
  size: string;
  quality: string;
  resolution?: string;
  hasReference?: boolean;
  type?: GenerationType;
}

export interface GenerationCostResult {
  usd: number;
  credits: number;
}

export function getGenerationCost(
  params: GenerationCostParams,
): GenerationCostResult {
  const type = params.type ?? GenerationType.IMAGE;

  // Flat-rate types (video, upscale)
  const flatCredits = FLAT_CREDIT_COSTS[type];
  if (flatCredits !== undefined) {
    return { usd: 0, credits: flatCredits };
  }

  const baseUsd = lookupUsdCost(
    params.provider,
    params.model,
    params.size,
    params.quality,
    params.resolution ?? '1K',
  );

  const referenceUsd = params.hasReference ? REFERENCE_IMAGE_USD : 0;
  const totalUsd = (baseUsd + referenceUsd) * MARGIN;
  const credits = Math.ceil(totalUsd * 100);

  return {
    usd: Math.round(totalUsd * 10000) / 10000,
    credits,
  };
}
