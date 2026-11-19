import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { SmsModule } from '../sms/sms.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { TokenService } from './token.service.js';
import { VerificationCodeService } from './verification-code.service.js';
import { WechatPhoneService } from './wechat-phone.service.js';

@Module({
  imports: [
    SmsModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwt.secret'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, VerificationCodeService, WechatPhoneService, TokenService, JwtStrategy],
})
export class AuthModule {}
