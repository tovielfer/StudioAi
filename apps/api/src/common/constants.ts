export enum GenerationType {
  IMAGE = 'image',
  VIDEO = 'video',
  UPSCALE = 'upscale',
}

export enum GenerationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DONE = 'done',
  FAILED = 'failed',
}

export enum ImageQuality {
  FAST = 'fast',
  STANDARD = 'standard',
  HD = 'hd',
}

export enum ImageSize {
  SQUARE = '1:1',
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
  WIDE = '4:3',
}

export enum AiProvider {
  REPLICATE = 'replicate',
  FAL = 'fal',
  OPENAI = 'openai',
  STABILITY = 'stability',
  MOCK = 'mock',
}

export const CREDIT_COSTS = {
  IMAGE_STANDARD: 5,
  IMAGE_HD: 10,
  REFERENCE_BONUS: 5,
  VIDEO: 50,
} as const;

export function calculateCreditCost(
  quality: ImageQuality,
  hasReference: boolean,
  type: GenerationType = GenerationType.IMAGE,
): number {
  if (type === GenerationType.VIDEO) return CREDIT_COSTS.VIDEO;

  let cost =
    quality === ImageQuality.HD
      ? CREDIT_COSTS.IMAGE_HD
      : CREDIT_COSTS.IMAGE_STANDARD;

  if (hasReference) cost += CREDIT_COSTS.REFERENCE_BONUS;
  return cost;
}
