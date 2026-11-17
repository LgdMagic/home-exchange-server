import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { AuthErrorCode } from './constants/auth-error-code.js';
import { isValidPhoneNumber } from './constants/supported-regions.js';

/**
 * 校验「区号 + 手机号」是否合法（区号在支持清单内，且格式符合该区号规则）。
 *
 * 与 spec.md「手机号区号选择与格式校验」对应。即使前端只展示支持清单内的区号选项，
 * 服务端仍需独立校验，不能只信任前端传入的值（见 backend.md 第 41 节）。
 */
export function assertValidPhone(countryCode: string, phoneNumber: string): void {
  if (!isValidPhoneNumber(countryCode, phoneNumber)) {
    throw new BusinessException(
      AuthErrorCode.PHONE_FORMAT_INVALID,
      '手机号格式不正确或该区号暂不支持',
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * 校验用户是否已勾选同意《用户协议》《隐私政策》。
 *
 * 与 spec.md「登录前用户协议确认」对应。
 */
export function assertAgreedToTerms(agreedToTerms: boolean): void {
  if (!agreedToTerms) {
    throw new BusinessException(
      AuthErrorCode.TERMS_NOT_AGREED,
      '请先同意《用户协议》和《隐私政策》',
      HttpStatus.BAD_REQUEST,
    );
  }
}
