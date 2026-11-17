import { Injectable, Logger } from '@nestjs/common';
import type { SendSmsParams, SmsSender } from './sms-sender.interface.js';

/**
 * 测试期生效的短信发送器：不发送任何真实短信，只记录结构化日志。
 *
 * 由 `AUTH_SMS_TEST_MODE=true` 时启用（见 sms-sender.provider.ts）。
 * 验证码的值是否固定为 999999，由 VerificationCodeService 的生成逻辑决定，
 * 本类只负责"不真正发短信"这一件事。
 */
@Injectable()
export class FixedTestCodeSmsSender implements SmsSender {
  private readonly logger = new Logger(FixedTestCodeSmsSender.name);

  async send(params: SendSmsParams): Promise<void> {
    this.logger.log(
      `[AUTH_SMS_TEST_MODE] Skipped sending real SMS to ${params.countryCode}${params.phoneNumber}; ` +
        'a fixed test verification code is in effect, see VerificationCodeService.',
    );
  }
}
