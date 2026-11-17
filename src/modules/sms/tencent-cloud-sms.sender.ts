import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SendSmsParams, SmsSender } from './sms-sender.interface.js';

/**
 * 腾讯云国际短信（Tencent Cloud SMS，大陆与国际/港澳台共用同一套 API，仅签名/模板不同）发送实现。
 *
 * === 当前状态：真实调用代码整体注释 ===
 * 等待腾讯云国际短信资质审批通过后，取消下方注释、安装所需依赖，并将 `AUTH_SMS_TEST_MODE`
 * 在生产环境设置为 `false` 即可切换为真实发送 —— 不需要改动任何调用方代码
 * （VerificationCodeService 始终只依赖 SmsSender 接口，见 sms-sender.provider.ts 的切换逻辑）。
 *
 * 启用步骤：
 * 1. `pnpm add tencentcloud-sdk-nodejs-sms`
 * 2. 在 `.env` 中配置：TENCENT_SMS_SECRET_ID / TENCENT_SMS_SECRET_KEY /
 *    TENCENT_SMS_SDK_APP_ID / TENCENT_SMS_SIGN_NAME / TENCENT_SMS_TEMPLATE_ID
 * 3. 取消下方 send() 方法体中的注释，删除 throw 语句
 * 4. 确认 `AUTH_SMS_TEST_MODE=false`（生产环境）
 */
@Injectable()
export class TencentCloudInternationalSmsSender implements SmsSender {
  constructor(private readonly configService: ConfigService) {}

  async send(_params: SendSmsParams): Promise<void> {
    void this.configService; // 占位引用，避免未使用字段告警；真实实现启用后会通过 configService 读取密钥

    throw new Error(
      'TencentCloudInternationalSmsSender 尚未启用：请在腾讯云国际短信资质审批通过后，' +
        '按本文件顶部注释中的「启用步骤」取消注释并配置相关环境变量，同时确认 AUTH_SMS_TEST_MODE=false。',
    );

    // --- 真实实现（审批通过后取消注释） ---
    //
    // const { sms } = await import('tencentcloud-sdk-nodejs-sms');
    // const SmsClient = sms.v20210111.Client;
    //
    // const client = new SmsClient({
    //   credential: {
    //     secretId: this.configService.getOrThrow<string>('sms.tencent.secretId'),
    //     secretKey: this.configService.getOrThrow<string>('sms.tencent.secretKey'),
    //   },
    //   region: '',
    //   profile: {
    //     httpProfile: {
    //       endpoint: 'sms.tencentcloudapi.com',
    //     },
    //   },
    // });
    //
    // await client.SendSms({
    //   SmsSdkAppId: this.configService.getOrThrow<string>('sms.tencent.sdkAppId'),
    //   SignName: this.configService.get<string>('sms.tencent.signName'),
    //   TemplateId: this.configService.getOrThrow<string>('sms.tencent.templateId'),
    //   TemplateParamSet: [_params.code],
    //   PhoneNumberSet: [`${_params.countryCode}${_params.phoneNumber}`],
    // });
  }
}
