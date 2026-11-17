export interface SendSmsParams {
  countryCode: string;
  phoneNumber: string;
  code: string;
}

/**
 * 厂商无关的短信发送接口，供 auth 及未来其它能力复用。
 *
 * 当前有两个实现：
 * - FixedTestCodeSmsSender：测试期生效，不发送真实短信（AUTH_SMS_TEST_MODE=true）。
 * - TencentCloudInternationalSmsSender：真实调用腾讯云国际短信，整体注释，等待资质审批通过后启用。
 *
 * 由 sms-sender.provider.ts 的 Provider 工厂按环境变量切换，调用方（VerificationCodeService）
 * 始终只注入 SMS_SENDER 这个 token，不关心具体是哪个实现。
 */
export interface SmsSender {
  send(params: SendSmsParams): Promise<void>;
}

export const SMS_SENDER = Symbol('SMS_SENDER');
