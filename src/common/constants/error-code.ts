/**
 * 通用错误码（与 HTTP Status 的粗粒度映射，供未归类到具体业务错误码的异常使用）。
 *
 * 具体业务错误码（例如 10001 USER_NOT_FOUND）应在对应 OpenSpec Change 的
 * design.md / docs/api/ 中定义，不要与此处的通用错误码混用或冲突。
 */
export enum CommonErrorCode {
  VALIDATION_ERROR = 10400,
  UNAUTHORIZED = 10401,
  FORBIDDEN = 10403,
  NOT_FOUND = 10404,
  CONFLICT = 10409,
  INTERNAL_ERROR = 50000,
}
