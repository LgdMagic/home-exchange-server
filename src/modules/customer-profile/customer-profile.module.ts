import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LivingDaysModule } from '../living-days/living-days.module.js';
import { CustomerProfileController } from './customer-profile.controller.js';
import { CustomerProfileService } from './customer-profile.service.js';
import { FaceidTestModeVerifier } from './faceid-test-mode.verifier.js';
import { IdCardPhotoStorage } from './id-card-photo.storage.js';
import { idCardVerifierProvider } from './id-card-verifier.provider.js';
import { RealNameVerificationController } from './real-name-verification.controller.js';
import { RealNameVerificationService } from './real-name-verification.service.js';
import { TencentIdCardVerifier } from './tencent-id-card.verifier.js';

@Module({
  imports: [AuthModule, LivingDaysModule],
  controllers: [CustomerProfileController, RealNameVerificationController],
  providers: [
    CustomerProfileService,
    RealNameVerificationService,
    IdCardPhotoStorage,
    FaceidTestModeVerifier,
    TencentIdCardVerifier,
    idCardVerifierProvider,
  ],
})
export class CustomerProfileModule {}
