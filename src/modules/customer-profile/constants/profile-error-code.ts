/**
 * customer-profile 能力专属错误码段：21000-21099。
 *
 * 通用错误码（10xxx）见 src/common/constants/error-code.ts；
 * customer-phone-auth 占用 20000-20099，见 src/modules/auth/constants/auth-error-code.ts。
 */
export enum ProfileErrorCode {
  PROFILE_STEP_OUT_OF_ORDER = 21001,
  PROFILE_NOT_COMPLETE = 21003,
  REAL_NAME_NOT_SUBMITTED = 21004,
  ID_CARD_NUMBER_INVALID = 21005,
  ID_CARD_ALREADY_BOUND = 21006,
  REAL_NAME_LOCKED = 21007,
  ID_CARD_PHOTOS_REQUIRED = 21008,
  ID_CARD_PHOTO_INVALID = 21009,
  ID_CARD_NAME_MISMATCH = 21010,
  ID_CARD_VERIFICATION_UNAVAILABLE = 21011,
}
