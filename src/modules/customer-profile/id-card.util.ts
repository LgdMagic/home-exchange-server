/**
 * 18 位大陆身份证号格式与校验码校验（GB 11643-1999），以及出生日期解析。
 *
 * 仅做"格式是否合法"的校验，不做任何真实身份核验（见 design.md Decisions 第 1 条：
 * 本次是自报占位阶段，没有公安/OCR 核验）。
 */

const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const CHECK_CODE_MAP = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
const ID_CARD_PATTERN = /^\d{17}[\dXx]$/;

export function isValidIdCardNumber(idCardNumber: string): boolean {
  if (!ID_CARD_PATTERN.test(idCardNumber)) {
    return false;
  }

  const digits = idCardNumber
    .slice(0, 17)
    .split('')
    .map((char) => Number(char));

  const sum = digits.reduce((acc, digit, index) => acc + digit * WEIGHTS[index], 0);
  const expectedCheckCode = CHECK_CODE_MAP[sum % 11];
  const actualCheckCode = idCardNumber[17].toUpperCase();

  if (actualCheckCode !== expectedCheckCode) {
    return false;
  }

  const birthDate = parseBirthDateFromIdCardNumber(idCardNumber);
  return isPlausibleBirthDate(birthDate);
}

/**
 * 从身份证号第 7-14 位（index 6-13）解析出生日期，格式 YYYYMMDD。
 *
 * 注意：`new Date('2023-02-30T...')` 不会得到 Invalid Date，而是静默"滚动"到
 * 2023-03-02——JS 对 ISO 字符串里的日/月溢出并不严格校验。因此这里额外用
 * getUTCFullYear/Month/Date 反查一遍，确认没有发生滚动，否则视为非法日期
 * （返回 Invalid Date，交给 isPlausibleBirthDate 统一拒绝）。
 */
export function parseBirthDateFromIdCardNumber(idCardNumber: string): Date {
  const year = Number(idCardNumber.slice(6, 10));
  const month = Number(idCardNumber.slice(10, 12));
  const day = Number(idCardNumber.slice(12, 14));

  const date = new Date(Date.UTC(year, month - 1, day));

  const rolledOver =
    date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day;

  return rolledOver ? new Date(Number.NaN) : date;
}

/** 必须是一个真实存在的日历日期，且不晚于当前日期（不做年龄限制，见 design.md Decisions 第 1 条）。 */
export function isPlausibleBirthDate(date: Date): boolean {
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.getTime() <= Date.now();
}
