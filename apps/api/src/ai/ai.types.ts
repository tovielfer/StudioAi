export interface GenerateImageParams {
  prompt: string;
  model: string;
  size: string;
  quality: string;
  referenceImage?: string | null;
  provider: string;
}

export interface ImageUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  input_tokens_details?: {
    text_tokens?: number;
    image_tokens?: number;
  };
}

export interface GenerateImageResult {
  imageUrl: string;
  provider: string;
  usage?: ImageUsage;
}
