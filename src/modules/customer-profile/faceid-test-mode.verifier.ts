import { Injectable } from '@nestjs/common';
import type {
  IdCardVerificationResult,
  IdCardVerifier,
} from './id-card-verifier.js';

/** 非生产环境跳过腾讯云调用。本地校验通过的姓名和身份证号视为一致。 */
@Injectable()
export class FaceidTestModeVerifier implements IdCardVerifier {
  verify(): Promise<IdCardVerificationResult> {
    return Promise.resolve({ matched: true, source: 'FACEID_TEST_MODE' });
  }
}
