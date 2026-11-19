/**
 * 资料预览页的敏感信息脱敏（spec.md「资料预览页的敏感信息脱敏展示」），后端直接返回脱敏后
 * 的值，而不是把完整明文传给前端再"视觉遮挡"——那样完整信息已经到了客户端，脱敏形同虚设。
 */

/** "张三" -> "张*"；只保留姓氏，其余用 * 遮盖。 */
export function maskRealName(realName: string): string {
  if (realName.length <= 1) {
    return realName;
  }

  return realName[0] + '*'.repeat(realName.length - 1);
}

const PHONE_MASK_PREFIX_LEN = 3;
const PHONE_MASK_SUFFIX_LEN = 4;

/** "13800138000" -> "138****8000"：首尾可见，中间用 * 遮盖（spec.md 要求的展示形式）。 */
export function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length <= PHONE_MASK_PREFIX_LEN + PHONE_MASK_SUFFIX_LEN) {
    return phoneNumber.length <= 1 ? phoneNumber : phoneNumber[0] + '*'.repeat(phoneNumber.length - 1);
  }

  const prefix = phoneNumber.slice(0, PHONE_MASK_PREFIX_LEN);
  const suffix = phoneNumber.slice(-PHONE_MASK_SUFFIX_LEN);
  const maskedLength = phoneNumber.length - PHONE_MASK_PREFIX_LEN - PHONE_MASK_SUFFIX_LEN;

  return prefix + '*'.repeat(maskedLength) + suffix;
}
