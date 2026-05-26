import { IsInt, IsString, IsUUID, Min } from 'class-validator';

export class AddCreditsDto {
  @IsUUID()
  userId: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsString()
  reason?: string;
}
