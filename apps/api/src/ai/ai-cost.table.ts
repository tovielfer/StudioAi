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

  mock: {
    default: {
      '1:1':  { fast: 0, standard: 0, hd: 0 },
      '16:9': { fast: 0, standard: 0, hd: 0 },
      '9:16': { fast: 0, standard: 0, hd: 0 },
      '4:3':  { fast: 0, standard: 0, hd: 0 },
    },
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

  return usd;
}

export interface GenerationCostParams {
  provider: string;
  model: string;
  size: string;
  quality: string;
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
  );

  const referenceUsd = params.hasReference ? REFERENCE_IMAGE_USD : 0;
  const totalUsd = (baseUsd + referenceUsd) * MARGIN;
  const credits = Math.ceil(totalUsd * 100);

  return {
    usd: Math.round(totalUsd * 10000) / 10000,
    credits,
  };
}
