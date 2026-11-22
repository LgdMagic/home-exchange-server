import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LivingDaysModule } from '../living-days/living-days.module.js';
import { CustomerProfileController } from './customer-profile.controller.js';
import { CustomerProfileService } from './customer-profile.service.js';
import { IdCardPhotoStorage } from './id-card-photo.storage.js';
import { RealNameVerificationController } from './real-name-verification.controller.js';
import { RealNameVerificationService } from './real-name-verification.service.js';

@Module({
  imports: [AuthModule, LivingDaysModule],
  controllers: [CustomerProfileController, RealNameVerificationController],
  providers: [
    CustomerProfileService,
    RealNameVerificationService,
    IdCardPhotoStorage,
  ],
})
export class CustomerProfileModule {}
