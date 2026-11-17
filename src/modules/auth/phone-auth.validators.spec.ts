import { BusinessException } from '../../common/exceptions/business.exception.js';
import { AuthErrorCode } from './constants/auth-error-code.js';
import { assertAgreedToTerms, assertValidPhone } from './phone-auth.validators.js';

describe('assertValidPhone', () => {
  it('does not throw for a valid country code + phone number', () => {
    expect(() => assertValidPhone('+86', '13800138000')).not.toThrow();
  });

  it('throws PHONE_FORMAT_INVALID for an unsupported country code', () => {
    try {
      assertValidPhone('+999', '12345678');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).code).toBe(AuthErrorCode.PHONE_FORMAT_INVALID);
    }
  });

  it('throws PHONE_FORMAT_INVALID for a phone number that does not match the region format', () => {
    try {
      assertValidPhone('+86', '12345678901');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).code).toBe(AuthErrorCode.PHONE_FORMAT_INVALID);
    }
  });
});

describe('assertAgreedToTerms', () => {
  it('does not throw when agreedToTerms is true', () => {
    expect(() => assertAgreedToTerms(true)).not.toThrow();
  });

  it('throws TERMS_NOT_AGREED when agreedToTerms is false', () => {
    try {
      assertAgreedToTerms(false);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).code).toBe(AuthErrorCode.TERMS_NOT_AGREED);
    }
  });
});
