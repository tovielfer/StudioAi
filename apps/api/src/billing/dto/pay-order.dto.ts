import { IsNotEmpty, IsString } from 'class-validator';

export class PayOrderDto {
  /** The og-token produced by payments.js in the browser. */
  @IsString()
  @IsNotEmpty()
  singleUseToken: string;
}
