import { IsBoolean, IsNotEmpty, IsString, Matches } from 'class-validator';

export class LoginWithSmsCodeDto {
  @IsString()
  @IsNotEmpty()
  countryCode!: string;

  @IsString()
  @Matches(/^\d{4,15}$/, { message: 'phoneNumber 必须是 4-15 位数字（不含区号）' })
  phoneNumber!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'code 必须是 6 位数字' })
  code!: string;

  @IsBoolean()
  agreedToTerms!: boolean;
}
