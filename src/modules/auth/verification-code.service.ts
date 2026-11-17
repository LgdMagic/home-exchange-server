import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SMS_SENDER, type SmsSender } from '../sms/sms-sender.interface.js';
import { AuthErrorCode } from './constants/auth-error-code.js';

/** 验证码有效期：5 分钟（spec.md「短信验证码发送与有效性规则」） */
const CODE_TTL_MS = 5 * 60 * 1000;
/** 同一「区号+手机号」重复发送冷却时间：60 秒 */
const RESEND_COOLDOWN_MS = 60 * 1000;
/** 同一「区号+手机号」1 小时内最多发送次数 */
const HOURLY_SEND_LIMIT = 5;
/** 验证码连续输错次数上限，达到后立即失效 */
const MAX_WRONG_ATTEMPTS = 5;
/** 测试期固定验证码（AUTH_SMS_TEST_MODE=true 时生效），仅用于内测，见 design.md Decisions 第 6 条 */
const FIXED_TEST_CODE = '999999';
/** bcrypt hash 的 salt rounds；验证码只有 6 位数字，无需像密码一样调得很高，兼顾性能 */
const CODE_HASH_SALT_ROUNDS = 8;

/**
 * 短信验证码业务规则：生成、发送、校验、频率限制。
 *
 * 频率限制通过查询 PhoneVerificationCode 按时间窗口计数实现，不引入 Redis
 * （见 design.md Risks 第 3 条：已知的轻微竞态可接受，后续放量可再评估）。
 */
@Injectable()
export class VerificationCodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(SMS_SENDER) private readonly smsSender: SmsSender,
  ) {}

  async sendCode(countryCode: string, phoneNumber: string): Promise<void> {
    const now = new Date();

    const lastSent = await this.prisma.phoneVerificationCode.findFirst({
      where: { countryCode, phoneNumber },
      orderBy: { createdAt: 'desc' },
    });

    if (lastSent && now.getTime() - lastSent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new BusinessException(
        AuthErrorCode.SMS_CODE_SEND_TOO_FREQUENT,
        '发送过于频繁，请稍后再试',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const sentInLastHour = await this.prisma.phoneVerificationCode.count({
      where: { countryCode, phoneNumber, createdAt: { gte: oneHourAgo } },
    });

    if (sentInLastHour >= HOURLY_SEND_LIMIT) {
      throw new BusinessException(
        AuthErrorCode.SMS_CODE_SEND_LIMIT_EXCEEDED,
        '已达到当前时段发送上限，请稍后再试',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.isTestMode() ? FIXED_TEST_CODE : this.generateRandomCode();
    const codeHash = await bcrypt.hash(code, CODE_HASH_SALT_ROUNDS);

    await this.prisma.phoneVerificationCode.create({
      data: {
        countryCode,
        phoneNumber,
        codeHash,
        expiresAt: new Date(now.getTime() + CODE_TTL_MS),
      },
    });

    await this.smsSender.send({ countryCode, phoneNumber, code });
  }

  async verifyCode(countryCode: string, phoneNumber: string, submittedCode: string): Promise<void> {
    const record = await this.prisma.phoneVerificationCode.findFirst({
      where: { countryCode, phoneNumber, consumedAt: null, invalidatedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      // 没有任何未消费/未失效的验证码记录：对用户而言等价于"验证码不对"，不额外区分
      // "从未发送过"这种内部状态，避免泄露账号/手机号是否存在验证码发送历史的信息。
      throw new BusinessException(AuthErrorCode.SMS_CODE_INVALID, '验证码错误', HttpStatus.BAD_REQUEST);
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new BusinessException(
        AuthErrorCode.SMS_CODE_EXPIRED,
        '验证码已过期，请重新获取',
        HttpStatus.BAD_REQUEST,
      );
    }

    const matches = await bcrypt.compare(submittedCode, record.codeHash);

    if (!matches) {
      const nextAttemptCount = record.attemptCount + 1;
      const shouldInvalidate = nextAttemptCount >= MAX_WRONG_ATTEMPTS;

      await this.prisma.phoneVerificationCode.update({
        where: { id: record.id },
        data: {
          attemptCount: nextAttemptCount,
          invalidatedAt: shouldInvalidate ? new Date() : undefined,
        },
      });

      if (shouldInvalidate) {
        throw new BusinessException(
          AuthErrorCode.SMS_CODE_ATTEMPTS_EXCEEDED,
          '验证码连续输错次数过多，请重新获取',
          HttpStatus.BAD_REQUEST,
        );
      }

      throw new BusinessException(AuthErrorCode.SMS_CODE_INVALID, '验证码错误', HttpStatus.BAD_REQUEST);
    }

    await this.prisma.phoneVerificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
  }

  private isTestMode(): boolean {
    return this.configService.get<boolean>('auth.smsTestMode') ?? true;
  }

  private generateRandomCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
