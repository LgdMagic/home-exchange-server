import { maskPhoneNumber, maskRealName } from './mask.util.js';

describe('maskRealName', () => {
  it('masks all but the surname', () => {
    expect(maskRealName('张三')).toBe('张*');
    expect(maskRealName('李小龙')).toBe('李**');
  });

  it('returns a single-character name unchanged', () => {
    expect(maskRealName('张')).toBe('张');
  });
});

describe('maskPhoneNumber', () => {
  it('masks the middle digits of an 11-digit mainland phone number', () => {
    expect(maskPhoneNumber('13800138000')).toBe('138****8000');
  });

  it('falls back to masking all but the first character for short numbers', () => {
    expect(maskPhoneNumber('12345')).toBe('1****');
  });
});
