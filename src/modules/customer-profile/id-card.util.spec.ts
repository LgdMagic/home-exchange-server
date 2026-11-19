import { isPlausibleBirthDate, isValidIdCardNumber, parseBirthDateFromIdCardNumber } from './id-card.util.js';

// 下面两个号码的校验码是用 GB 11643-1999 算法现算出来的真实合法号码（非随意编造）。
const VALID_ID_1 = '110101199003078515'; // 出生日期 1990-03-07
const VALID_ID_2 = '440302198501011232'; // 出生日期 1985-01-01

describe('isValidIdCardNumber', () => {
  it('accepts a valid 18-digit id card number', () => {
    expect(isValidIdCardNumber(VALID_ID_1)).toBe(true);
    expect(isValidIdCardNumber(VALID_ID_2)).toBe(true);
  });

  it('rejects a number with the wrong length', () => {
    expect(isValidIdCardNumber('1101011990030785')).toBe(false);
  });

  it('rejects a number with an incorrect check code', () => {
    const tampered = VALID_ID_1.slice(0, -1) + (VALID_ID_1.endsWith('5') ? '6' : '5');
    expect(isValidIdCardNumber(tampered)).toBe(false);
  });

  it('rejects a number whose embedded date is not a real calendar date (e.g. Feb 30)', () => {
    // 前 6 位区划码随意取一个格式合法的，关键是第 7-14 位构造成 19900230（不存在的日期）
    const invalidDateBody = '11010119900230851';
    const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const CHECK_CODE_MAP = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
    const sum = invalidDateBody
      .split('')
      .map(Number)
      .reduce((acc, d, i) => acc + d * WEIGHTS[i], 0);
    const idCardNumber = invalidDateBody + CHECK_CODE_MAP[sum % 11];

    expect(isValidIdCardNumber(idCardNumber)).toBe(false);
  });

  it('rejects a number containing non-digit characters outside the trailing check code', () => {
    expect(isValidIdCardNumber('11010A199003078515')).toBe(false);
  });

  it('accepts a lowercase trailing x as the check code', () => {
    // 构造一个校验码应为 X 的号码，并验证小写 x 也能被接受
    const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const CHECK_CODE_MAP = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
    // 从一个已知合法号码出发微调前 17 位，直到凑出 checkCode === 'X'
    let first17 = '11010119900307851';
    let checkCode = '';
    for (let last = 0; last <= 9; last += 1) {
      const candidate = first17.slice(0, 16) + String(last);
      const sum = candidate
        .split('')
        .map(Number)
        .reduce((acc, d, i) => acc + d * WEIGHTS[i], 0);
      if (CHECK_CODE_MAP[sum % 11] === 'X') {
        first17 = candidate;
        checkCode = 'X';
        break;
      }
    }

    expect(checkCode).toBe('X');
    expect(isValidIdCardNumber(first17 + 'x')).toBe(true);
  });
});

describe('parseBirthDateFromIdCardNumber', () => {
  it('parses the birth date encoded in positions 7-14', () => {
    const date = parseBirthDateFromIdCardNumber(VALID_ID_1);
    expect(date.getUTCFullYear()).toBe(1990);
    expect(date.getUTCMonth()).toBe(2); // 0-indexed：3 月
    expect(date.getUTCDate()).toBe(7);
  });

  it('returns an Invalid Date for a non-existent calendar date instead of silently rolling over', () => {
    const date = parseBirthDateFromIdCardNumber('11010119900230851X');
    expect(Number.isNaN(date.getTime())).toBe(true);
  });
});

describe('isPlausibleBirthDate', () => {
  it('accepts a date in the past', () => {
    expect(isPlausibleBirthDate(new Date('1990-01-01T00:00:00.000Z'))).toBe(true);
  });

  it('rejects an Invalid Date', () => {
    expect(isPlausibleBirthDate(new Date(Number.NaN))).toBe(false);
  });

  it('rejects a date in the future', () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(isPlausibleBirthDate(future)).toBe(false);
  });
});
