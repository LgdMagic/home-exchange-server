import { Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FixedTestCodeSmsSender } from './fixed-test-code.sender.js';
import { SMS_SENDER } from './sms-sender.interface.js';
import { TencentCloudInternationalSmsSender } from './tencent-cloud-sms.sender.js';

const logger = new Logger('SmsSenderProvider');

/**
 * 按环境变量切换真实短信实现 / 测试期固定实现。
 *
 * 硬性安全保护：若 NODE_ENV=production 且 AUTH_SMS_TEST_MODE=true，直接阻止应用启动——
 * 防止"测试期固定验证码"配置被疏忽带入生产环境（见 design.md「add-customer-phone-login」
 * Decisions 第 6 条）。
 */
export const smsSenderProvider: Provider = {
  provide: SMS_SENDER,
  inject: [ConfigService, FixedTestCodeSmsSender, TencentCloudInternationalSmsSender],
  useFactory: (
    configService: ConfigService,
    fixedTestCodeSmsSender: FixedTestCodeSmsSender,
    tencentCloudInternationalSmsSender: TencentCloudInternationalSmsSender,
  ) => {
    const nodeEnv = configService.get<string>('app.nodeEnv');
    const testMode = configService.get<boolean>('auth.smsTestMode');

    if (nodeEnv === 'production' && testMode) {
      throw new Error(
        'AUTH_SMS_TEST_MODE 在生产环境下必须为 false。拒绝以"固定测试验证码 999999"模式启动生产环境，' +
          '这会让任意手机号都能绕过真实短信验证完成登录。',
      );
    }

    if (testMode) {
      logger.warn(
        'AUTH_SMS_TEST_MODE 已开启：验证码固定为 999999，不会发送真实短信。仅应在非生产环境使用。',
      );
      return fixedTestCodeSmsSender;
    }

    return tencentCloudInternationalSmsSender;
  },
};
