import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class LoginWithWechatPhoneDto {
  /** wx.getPhoneNumber 回调中返回的 code，一次性、短时效，由服务端换取真实手机号 */
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsBoolean()
  agreedToTerms!: boolean;
}
