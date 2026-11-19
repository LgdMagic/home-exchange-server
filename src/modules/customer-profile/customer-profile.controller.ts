import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentAccountId } from '../../common/decorators/current-account-id.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CustomerProfileService, type ProfileView } from './customer-profile.service.js';
import { UpdateAccommodationTravelDto } from './dto/update-accommodation-travel.dto.js';
import { UpdateBasicInfoDto } from './dto/update-basic-info.dto.js';
import { UpdateLifestyleDto } from './dto/update-lifestyle.dto.js';
import { SubmitRealNameDto } from './dto/submit-real-name.dto.js';
import { RealNameVerificationService } from './real-name-verification.service.js';

/**
 * customer-profile：C 端个人资料编辑接口。全部需要登录（Consumer=Client）。
 * 详细契约见 docs/api/F002-customer-profile-setup.md。
 */
@Controller('customer/profile')
@UseGuards(JwtAuthGuard)
export class CustomerProfileController {
  constructor(
    private readonly customerProfileService: CustomerProfileService,
    private readonly realNameVerificationService: RealNameVerificationService,
  ) {}

  @Get()
  async getProfile(@CurrentAccountId() accountId: string): Promise<ProfileView> {
    return this.customerProfileService.getProfileView(accountId);
  }

  @Post('real-name-placeholder')
  @HttpCode(HttpStatus.OK)
  async submitRealNamePlaceholder(
    @CurrentAccountId() accountId: string,
    @Body() dto: SubmitRealNameDto,
  ): Promise<{ success: true }> {
    await this.realNameVerificationService.submit(accountId, dto);
    return { success: true };
  }

  @Put('basic-info')
  @HttpCode(HttpStatus.OK)
  async updateBasicInfo(
    @CurrentAccountId() accountId: string,
    @Body() dto: UpdateBasicInfoDto,
  ): Promise<{ success: true }> {
    await this.customerProfileService.updateBasicInfo(accountId, dto);
    return { success: true };
  }

  @Put('lifestyle')
  @HttpCode(HttpStatus.OK)
  async updateLifestyle(
    @CurrentAccountId() accountId: string,
    @Body() dto: UpdateLifestyleDto,
  ): Promise<{ success: true }> {
    await this.customerProfileService.updateLifestyle(accountId, dto);
    return { success: true };
  }

  @Put('accommodation-travel')
  @HttpCode(HttpStatus.OK)
  async updateAccommodationTravel(
    @CurrentAccountId() accountId: string,
    @Body() dto: UpdateAccommodationTravelDto,
  ): Promise<{ success: true }> {
    await this.customerProfileService.updateAccommodationTravel(accountId, dto);
    return { success: true };
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  async complete(@CurrentAccountId() accountId: string): Promise<{ success: true }> {
    await this.customerProfileService.complete(accountId);
    return { success: true };
  }
}
