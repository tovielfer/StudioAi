import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { FeedbackType } from '../feedback-submission.entity';

export class CreateFeedbackDto {
  @IsEnum(FeedbackType)
  type: FeedbackType;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  message: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;
}
