/**
 * customer-phone-auth 能力专属错误码段：20000-20099。
 *
 * 通用错误码（10xxx 段：校验/鉴权/权限/未找到/内部错误等）见 src/common/constants/error-code.ts，
 * 本段只用于本能力特有的业务错误。
 */
export enum AuthErrorCode {
  PHONE_FORMAT_INVALID = 20001,
  SMS_CODE_SEND_TOO_FREQUENT = 20002,
  SMS_CODE_SEND_LIMIT_EXCEEDED = 20003,
  SMS_CODE_EXPIRED = 20004,
  SMS_CODE_INVALID = 20005,
  SMS_CODE_ATTEMPTS_EXCEEDED = 20006,
  TERMS_NOT_AGREED = 20007,
  WECHAT_PHONE_AUTH_FAILED = 20008,
}
