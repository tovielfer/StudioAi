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

export enum ImageResolution {
  ONE_K = '1K',
  TWO_K = '2K',
  FOUR_K = '4K',
}

export enum AiProvider {
  REPLICATE = 'replicate',
  FAL = 'fal',
  OPENAI = 'openai',
  STABILITY = 'stability',
  GOOGLE = 'google',
  MOCK = 'mock',
}

export { getGenerationCost } from '../ai/ai-cost.table';
