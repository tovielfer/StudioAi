import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// Coerces the loose values that arrive over query strings / JSON ("true",
// "false", 1, 0) into real booleans so the class-validator @IsBoolean checks
// behave predictably.
const toBoolean = ({ value }: { value: unknown }) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return value;
};

export class SendBroadcastDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  subject: string;

  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  message: string;

  // Only send to users who verified their email. Defaults to true so we don't
  // blast unconfirmed/typo'd addresses (which hurts sender reputation).
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  onlyVerified?: boolean;

  // Skip blocked users. Defaults to true.
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  excludeBlocked?: boolean;

  // Skip admin accounts. Defaults to false (admins receive it too).
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  excludeAdmins?: boolean;
}

// A single test copy of the broadcast, sent to one address so the admin can
// preview the exact rendered email before sending to the whole audience.
export class SendBroadcastTestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  subject: string;

  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  message: string;

  @IsEmail()
  to: string;
}
