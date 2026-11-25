/**
 * 腾讯云「身份信息认证（二要素核验）」IdCardVerification。
 * 文档：https://cloud.tencent.com/document/api/1007/33188
 * 只传姓名和身份证号，不传证件照片。
 */
export type IdCardVerificationResult =
  | {
      matched: true;
      source: 'TENCENT_ID_CARD_VERIFICATION' | 'FACEID_TEST_MODE';
    }
  | { matched: false; result: string };

export interface IdCardVerifier {
  verify(name: string, idCardNumber: string): Promise<IdCardVerificationResult>;
}

export const ID_CARD_VERIFIER = Symbol('ID_CARD_VERIFIER');
