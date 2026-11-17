import type { ConfigService } from '@nestjs/config';
import { FixedTestCodeSmsSender } from './fixed-test-code.sender.js';
import { smsSenderProvider } from './sms-sender.provider.js';
import { TencentCloudInternationalSmsSender } from './tencent-cloud-sms.sender.js';

function createConfigServiceMock(values: Record<string, unknown>) {
  return {
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('smsSenderProvider', () => {
  // smsSenderProvider 是一个 Nest Provider 对象（ClassProvider/FactoryProvider 的联合类型），
  // 这里只用它的 useFactory 字段，因此需要断言其具体形态。
  const factory = (smsSenderProvider as { useFactory: (...args: never[]) => unknown }).useFactory;

  it('throws when running in production with AUTH_SMS_TEST_MODE enabled', () => {
    const configService = createConfigServiceMock({ 'app.nodeEnv': 'production', 'auth.smsTestMode': true });
    const fixedSender = new FixedTestCodeSmsSender();
    const tencentSender = new TencentCloudInternationalSmsSender(configService);

    expect(() => factory(configService, fixedSender, tencentSender)).toThrow(/AUTH_SMS_TEST_MODE/);
  });

  it('returns the fixed test sender when test mode is enabled outside production', () => {
    const configService = createConfigServiceMock({ 'app.nodeEnv': 'development', 'auth.smsTestMode': true });
    const fixedSender = new FixedTestCodeSmsSender();
    const tencentSender = new TencentCloudInternationalSmsSender(configService);

    expect(factory(configService, fixedSender, tencentSender)).toBe(fixedSender);
  });

  it('returns the Tencent Cloud sender when test mode is disabled', () => {
    const configService = createConfigServiceMock({ 'app.nodeEnv': 'production', 'auth.smsTestMode': false });
    const fixedSender = new FixedTestCodeSmsSender();
    const tencentSender = new TencentCloudInternationalSmsSender(configService);

    expect(factory(configService, fixedSender, tencentSender)).toBe(tencentSender);
  });
});
