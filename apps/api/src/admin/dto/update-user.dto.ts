import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nickname?: string | null;

  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;
}
