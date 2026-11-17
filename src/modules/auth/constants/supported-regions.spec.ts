import { findSupportedRegion, isValidPhoneNumber, normalizeCountryCode } from './supported-regions.js';

describe('supported-regions', () => {
  describe('isValidPhoneNumber', () => {
    const validCases: Array<[string, string]> = [
      ['+86', '13800138000'],
      ['+852', '51234567'],
      ['+853', '61234567'],
      ['+886', '912345678'],
      ['+1', '2025550123'],
      ['+65', '81234567'],
      ['+61', '412345678'],
      ['+44', '7123456789'],
      ['+81', '7012345678'],
      ['+82', '1012345678'],
    ];

    it.each(validCases)('accepts a valid %s number %s', (countryCode, phoneNumber) => {
      expect(isValidPhoneNumber(countryCode, phoneNumber)).toBe(true);
    });

    const invalidCases: Array<[string, string]> = [
      ['+86', '12345678901'], // 第二位不在 3-9 范围
      ['+86', '1380013800'], // 少一位
      ['+852', '1234567'], // 少一位
      ['+1', '123'], // 位数不够
    ];

    it.each(invalidCases)('rejects an invalid %s number %s', (countryCode, phoneNumber) => {
      expect(isValidPhoneNumber(countryCode, phoneNumber)).toBe(false);
    });

    it('rejects a country code outside the supported list', () => {
      expect(isValidPhoneNumber('+999', '12345678')).toBe(false);
    });
  });

  describe('findSupportedRegion', () => {
    it('finds a region in the supported list', () => {
      expect(findSupportedRegion('+86')?.label).toBe('中国大陆');
    });

    it('returns undefined for an unsupported region', () => {
      expect(findSupportedRegion('+999')).toBeUndefined();
    });
  });

  describe('normalizeCountryCode', () => {
    it('adds a leading + when missing', () => {
      expect(normalizeCountryCode('86')).toBe('+86');
    });

    it('keeps the leading + when already present', () => {
      expect(normalizeCountryCode('+86')).toBe('+86');
    });
  });
});
