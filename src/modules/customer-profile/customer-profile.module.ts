import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CustomerProfileController } from './customer-profile.controller.js';
import { CustomerProfileService } from './customer-profile.service.js';
import { RealNameVerificationService } from './real-name-verification.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CustomerProfileController],
  providers: [CustomerProfileService, RealNameVerificationService],
})
export class CustomerProfileModule {}
