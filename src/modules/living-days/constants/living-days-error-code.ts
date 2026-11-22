/**
 * living-days 能力专属错误码段：22000-22099。
 *
 * 这些码由后续交换模块原样往外抛。本次会员能调用的只有查询接口。
 */
export enum LivingDaysErrorCode {
  BENEFIT_PACKAGE_NOT_APPLICABLE = 22001,
  BENEFIT_PACKAGE_ALREADY_OPEN = 22002,
  INSUFFICIENT_LIVING_DAYS = 22003,
  EXCHANGE_NOT_OPEN = 22004,
  ACTUAL_DAYS_EXCEED_SELECTED = 22005,
}
