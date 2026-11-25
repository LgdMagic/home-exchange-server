import { Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FaceidTestModeVerifier } from './faceid-test-mode.verifier.js';
import { ID_CARD_VERIFIER } from './id-card-verifier.js';
import { TencentIdCardVerifier } from './tencent-id-card.verifier.js';

const logger = new Logger('IdCardVerifierProvider');

/**
 * 生产环境必须调用腾讯云二要素核验。
 * FACEID_TEST_MODE 只允许在非生产环境打开，打开后不访问腾讯云。
 */
export const idCardVerifierProvider: Provider = {
  provide: ID_CARD_VERIFIER,
  inject: [ConfigService, FaceidTestModeVerifier, TencentIdCardVerifier],
  useFactory: (
    configService: ConfigService,
    testModeVerifier: FaceidTestModeVerifier,
    tencentVerifier: TencentIdCardVerifier,
  ) => {
    const appEnv = configService.get<string>('app.appEnv');
    const testMode = configService.get<boolean>('faceid.testMode');
    if (appEnv === 'production' && testMode) {
      throw new Error(
        'FACEID_TEST_MODE 在生产环境（APP_ENV=production）下必须为 false。拒绝跳过腾讯云身份证二要素核验。',
      );
    }

    if (!testMode) {
      const secretId = configService.get<string>('faceid.secretId');
      const secretKey = configService.get<string>('faceid.secretKey');
      if (!secretId || !secretKey) {
        throw new Error(
          '未配置 TENCENT_FACEID_SECRET_ID / TENCENT_FACEID_SECRET_KEY，无法调用身份证二要素核验。',
        );
      }
      return tencentVerifier;
    }

    logger.warn(
      `FACEID_TEST_MODE 已开启（APP_ENV=${appEnv}）：跳过腾讯云身份证二要素核验。仅应在非生产环境使用。`,
    );
    return testModeVerifier;
  },
};
