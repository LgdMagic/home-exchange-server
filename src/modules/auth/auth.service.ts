import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { LoginWithSmsCodeDto } from './dto/login-with-sms-code.dto.js';
import type { LoginWithWechatPhoneDto } from './dto/login-with-wechat-phone.dto.js';
import type { SendSmsCodeDto } from './dto/send-sms-code.dto.js';
import { assertAgreedToTerms, assertValidPhone } from './phone-auth.validators.js';
import { TokenService } from './token.service.js';
import { VerificationCodeService } from './verification-code.service.js';
import { WechatPhoneService } from './wechat-phone.service.js';

/** 当前生效的用户协议/隐私政策版本号，见 product/ 下协议文档；随协议更新需要同步调整 */
const CURRENT_TERMS_VERSION = 'v1';

export interface LoginResultAccount {
  id: string;
  countryCode: string;
  phoneNumber: string;
  nickname: string | null;
  avatarUrl: string | null;
  isNewAccount: boolean;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  account: LoginResultAccount;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly wechatPhoneService: WechatPhoneService,
    private readonly tokenService: TokenService,
  ) {}

  async sendSmsCode(dto: SendSmsCodeDto): Promise<void> {
    assertValidPhone(dto.countryCode, dto.phoneNumber);
    await this.verificationCodeService.sendCode(dto.countryCode, dto.phoneNumber);
  }

  async loginWithSmsCode(dto: LoginWithSmsCodeDto): Promise<LoginResult> {
    assertValidPhone(dto.countryCode, dto.phoneNumber);
    assertAgreedToTerms(dto.agreedToTerms);
    await this.verificationCodeService.verifyCode(dto.countryCode, dto.phoneNumber, dto.code);
    return this.loginOrRegister(dto.countryCode, dto.phoneNumber);
  }

  async loginWithWechatPhone(dto: LoginWithWechatPhoneDto): Promise<LoginResult> {
    assertAgreedToTerms(dto.agreedToTerms);
    const { countryCode, phoneNumber } = await this.wechatPhoneService.resolvePhoneNumber(dto.code);
    // 微信返回的区号自带，无需再走 assertValidPhone 的区号清单校验（见 spec.md
    // 「微信返回的手机号自带区号信息」场景），但仍交由同一套登录/注册逻辑处理唯一性。
    return this.loginOrRegister(countryCode, phoneNumber);
  }

  /**
   * 登录即注册：按「区号+手机号」查找账号，不存在则创建；处理并发创建时的唯一约束冲突。
   */
  private async loginOrRegister(countryCode: string, phoneNumber: string): Promise<LoginResult> {
    let account = await this.prisma.account.findUnique({
      where: { countryCode_phoneNumber: { countryCode, phoneNumber } },
    });

    let isNewAccount = false;

    if (!account) {
      try {
        account = await this.prisma.account.create({
          data: {
            countryCode,
            phoneNumber,
            termsAgreedAt: new Date(),
            termsVersion: CURRENT_TERMS_VERSION,
          },
        });
        isNewAccount = true;
      } catch (error) {
        // 并发请求可能同时命中唯一约束冲突：重新查询一次而不是直接把 500 抛给用户
        // （见 backend.md 第 14 节：唯一性不能只靠「先查询再插入」）。
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          account = await this.prisma.account.findUniqueOrThrow({
            where: { countryCode_phoneNumber: { countryCode, phoneNumber } },
          });
        } else {
          throw error;
        }
      }
    } else if (!account.termsAgreedAt) {
      // 历史数据兜底：已存在账号但此前未记录协议同意时间，本次登录即视为同意并补上记录
      account = await this.prisma.account.update({
        where: { id: account.id },
        data: { termsAgreedAt: new Date(), termsVersion: CURRENT_TERMS_VERSION },
      });
    }

    const tokens = await this.tokenService.issueTokens(account.id);

    return {
      ...tokens,
      account: {
        id: account.id,
        countryCode: account.countryCode,
        phoneNumber: account.phoneNumber,
        nickname: account.nickname,
        avatarUrl: account.avatarUrl,
        isNewAccount,
      },
    };
  }
}
