import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService, type LoginResult } from './auth.service.js';
import { LoginWithSmsCodeDto } from './dto/login-with-sms-code.dto.js';
import { LoginWithWechatPhoneDto } from './dto/login-with-wechat-phone.dto.js';
import { SendSmsCodeDto } from './dto/send-sms-code.dto.js';

export interface SendSmsCodeResult {
  cooldownSeconds: number;
}

/**
 * customer-phone-auth：C 端（uniapp）手机号登录/注册接口。
 *
 * 全部 Not Required Authentication（登录前接口本身不需要鉴权），Consumer=Client。
 * 详细契约见 docs/api/F001-customer-phone-login.md。
 */
@Controller('customer/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sms-code')
  @HttpCode(HttpStatus.OK)
  async sendSmsCode(@Body() dto: SendSmsCodeDto): Promise<SendSmsCodeResult> {
    await this.authService.sendSmsCode(dto);
    return { cooldownSeconds: 60 };
  }

  @Post('login/sms')
  @HttpCode(HttpStatus.OK)
  async loginWithSms(@Body() dto: LoginWithSmsCodeDto): Promise<LoginResult> {
    return this.authService.loginWithSmsCode(dto);
  }

  @Post('login/wechat-phone')
  @HttpCode(HttpStatus.OK)
  async loginWithWechatPhone(@Body() dto: LoginWithWechatPhoneDto): Promise<LoginResult> {
    return this.authService.loginWithWechatPhone(dto);
  }
}
