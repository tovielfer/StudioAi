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
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  AUTO = 'auto',
}

export enum ImageSize {
  SQUARE = '1:1',
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
  WIDE = '4:3',
  PORTRAIT_STANDARD = '3:4',
  PHOTO_LANDSCAPE = '3:2',
  PHOTO_PORTRAIT = '2:3',
  SOCIAL_PORTRAIT = '4:5',
  SOCIAL_LANDSCAPE = '5:4',
  ULTRAWIDE = '21:9',
  CINEMATIC_PORTRAIT = '9:21',
  PANORAMA_WIDE = '4:1',
  STRIP_WIDE = '8:1',
  PANORAMA_TALL = '1:4',
  STRIP_TALL = '1:8',
}

export enum ImageResolution {
  FIVE_TWELVE = '512',
  ONE_K = '1K',
  TWO_K = '2K',
  FOUR_K = '4K',
  // Video resolution tiers (Seedance). Stored as plain strings; kept here so
  // the create DTO's @IsEnum validation accepts them.
  P_480 = '480p',
  P_720 = '720p',
  P_1080 = '1080p',
  P_4K = '4k',
}

export enum AiProvider {
  REPLICATE = 'replicate',
  FAL = 'fal',
  OPENAI = 'openai',
  STABILITY = 'stability',
  GOOGLE = 'google',
  MOCK = 'mock',
}
