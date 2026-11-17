import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendSmsCodeDto {
  @IsString()
  @IsNotEmpty()
  countryCode!: string;

  @IsString()
  @Matches(/^\d{4,15}$/, { message: 'phoneNumber 必须是 4-15 位数字（不含区号）' })
  phoneNumber!: string;
}
