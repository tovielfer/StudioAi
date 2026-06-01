import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
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
}
