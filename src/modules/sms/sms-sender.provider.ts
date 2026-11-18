import { Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FixedTestCodeSmsSender } from './fixed-test-code.sender.js';
import { SMS_SENDER } from './sms-sender.interface.js';
import { TencentCloudInternationalSmsSender } from './tencent-cloud-sms.sender.js';

const logger = new Logger('SmsSenderProvider');

/**
 * 按环境变量切换真实短信实现 / 测试期固定实现。
 *
 * 硬性安全保护：若 APP_ENV=production 且 AUTH_SMS_TEST_MODE=true，直接阻止应用启动——
 * 防止"测试期固定验证码"配置被疏忽带入真正的生产环境（见 design.md「add-customer-phone-login」
 * Decisions 第 6 条）。
 *
 * 注意这里判断的是 `app.appEnv`，不是 `app.nodeEnv`：持续部署运行的测试/预发环境通常也会把
 * NODE_ENV 设为 "production" 以获得框架层面的优化，但它们不是真正的生产环境，不应该被这条
 * 安全保护拦住——"是否允许固定验证码"这件事只应该由 APP_ENV 是否为 production 决定。
 */
export const smsSenderProvider: Provider = {
  provide: SMS_SENDER,
  inject: [ConfigService, FixedTestCodeSmsSender, TencentCloudInternationalSmsSender],
  useFactory: (
    configService: ConfigService,
    fixedTestCodeSmsSender: FixedTestCodeSmsSender,
    tencentCloudInternationalSmsSender: TencentCloudInternationalSmsSender,
  ) => {
    const appEnv = configService.get<string>('app.appEnv');
    const testMode = configService.get<boolean>('auth.smsTestMode');

    if (appEnv === 'production' && testMode) {
      throw new Error(
        'AUTH_SMS_TEST_MODE 在生产环境（APP_ENV=production）下必须为 false。拒绝以"固定测试验证码 ' +
          '999999"模式启动生产环境，这会让任意手机号都能绕过真实短信验证完成登录。',
      );
    }

    if (testMode) {
      logger.warn(
        `AUTH_SMS_TEST_MODE 已开启（APP_ENV=${appEnv}）：验证码固定为 999999，不会发送真实短信。` +
          '仅应在非生产环境使用。',
      );
      return fixedTestCodeSmsSender;
    }

    return tencentCloudInternationalSmsSender;
  },
};
