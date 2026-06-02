import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class UpdatePricingRuleDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  referenceImageUsd?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  margin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  creditCostOverride?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
