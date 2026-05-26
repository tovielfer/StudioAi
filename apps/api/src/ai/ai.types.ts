export interface GenerateImageParams {
  prompt: string;
  model: string;
  size: string;
  quality: string;
  referenceImage?: string | null;
  provider: string;
}

export interface GenerateImageResult {
  imageUrl: string;
  provider: string;
}
