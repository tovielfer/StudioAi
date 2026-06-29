import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PayOrderDto {
  /** The og-token produced by payments.js in the browser. */
  @IsString()
  @IsNotEmpty()
  singleUseToken: string;

  /** When true, vault this card in SUMIT for faster future purchases. */
  @IsOptional()
  @IsBoolean()
  saveCard?: boolean;
}
