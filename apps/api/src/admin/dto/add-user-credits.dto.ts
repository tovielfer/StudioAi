import { IsInt, IsOptional, IsString, NotEquals } from 'class-validator';

export class AddUserCreditsDto {
  @IsInt()
  @NotEquals(0)
  amount: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
