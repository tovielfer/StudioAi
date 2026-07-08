import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PayOrderDto {
  /** The og-token produced by payments.js in the browser. */
  @IsString()
  @IsNotEmpty()
  singleUseToken: string;

  /** Save the card (as a SUMIT token) for future charges. Defaults to true. */
  @IsOptional()
  @IsBoolean()
  saveCard?: boolean;
}
