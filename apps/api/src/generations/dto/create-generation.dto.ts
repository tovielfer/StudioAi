import {
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  ImageQuality,
  ImageSize,
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
  @IsEnum(AiProvider)
  provider?: AiProvider;

  @IsOptional()
  @IsEnum(GenerationType)
  type?: GenerationType;

  @IsOptional()
  @IsString()
  referenceImageUrl?: string;
}
