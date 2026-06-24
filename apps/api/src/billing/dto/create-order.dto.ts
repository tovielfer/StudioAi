import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  packageId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
