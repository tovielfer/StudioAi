import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  ImageQuality,
  ImageSize,
  ImageResolution,
  AiProvider,
  GenerationType,
} from '../../common/constants';

export class CreateGenerationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  prompt: string;

  @IsString()
  model: string;

  @IsOptional()
  @IsEnum(ImageQuality)
  quality?: ImageQuality;

  @IsOptional()
  @IsEnum(ImageSize)
  size?: ImageSize;

  @IsOptional()
  @IsEnum(ImageResolution)
  resolution?: ImageResolution;

  @IsOptional()
  @IsEnum(AiProvider)
  provider?: AiProvider;

  @IsOptional()
  @IsEnum(GenerationType)
  type?: GenerationType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  referenceImageUrls?: string[];

  // Video only: clip length in seconds (clamped to the model's allowed set).
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  durationSeconds?: number;

  // Video only: generate native audio (v3 models).
  @IsOptional()
  @IsBoolean()
  generateAudio?: boolean;
}
