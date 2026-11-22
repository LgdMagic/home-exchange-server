import { HttpStatus, Injectable } from '@nestjs/common';
import {
  ProfileSetupStep,
  type RealNameVerificationStatus,
} from '../../generated/prisma/enums.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ProfileErrorCode } from './constants/profile-error-code.js';
import type { UpdateAccommodationTravelDto } from './dto/update-accommodation-travel.dto.js';
import type { UpdateBasicInfoDto } from './dto/update-basic-info.dto.js';
import type { UpdateLifestyleDto } from './dto/update-lifestyle.dto.js';
import { maskPhoneNumber, maskRealName } from './mask.util.js';
import { LivingDaysService } from '../living-days/living-days.service.js';
import { RealNameVerificationService } from './real-name-verification.service.js';

export interface ProfileView {
  /** null 表示尚未提交；PENDING 表示已提交、待核验。不能据此展示「已实名认证」。 */
  realNameStatus: RealNameVerificationStatus | null;
  realName: string | null;
  birthDate: Date | null;
  phoneNumber: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  gender: string | null;
  city: string | null;
  occupation: string | null;
  bio: string | null;
  sleepSchedule: string | null;
  atmospherePreference: string | null;
  drinking: string | null;
  smoking: string | null;
  hasPets: string | null;
  petAttitude: string | null;
  lifestyleTidiness: string | null;
  interests: string[];
  homeTypes: string[];
  spaceFeatures: string[];
  livingNeeds: string[];
  travelCompanions: string[];
  travelStyles: string[];
  cityExplorationStyles: string[];
  travelFrequency: string | null;
  languages: string[];
  currentStep: string;
  basicInfoCompletedAt: Date | null;
  lifestyleCompletedAt: Date | null;
  accommodationTravelCompletedAt: Date | null;
  profileCompletedAt: Date | null;
}

@Injectable()
export class CustomerProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realNameVerificationService: RealNameVerificationService,
    private readonly livingDaysService: LivingDaysService,
  ) {}

  async getProfileView(accountId: string): Promise<ProfileView> {
    const [profile, account, realNameInfo] = await Promise.all([
      this.getOrCreateProfile(accountId),
      this.prisma.account.findUniqueOrThrow({
        where: { id: accountId },
        select: { nickname: true, avatarUrl: true, phoneNumber: true },
      }),
      this.realNameVerificationService.findByAccountId(accountId),
    ]);

    return {
      realNameStatus: realNameInfo?.status ?? null,
      realName: realNameInfo ? maskRealName(realNameInfo.realName) : null,
      birthDate: realNameInfo?.birthDate ?? null,
      phoneNumber: account.phoneNumber
        ? maskPhoneNumber(account.phoneNumber)
        : null,
      nickname: account.nickname,
      avatarUrl: account.avatarUrl,
      gender: profile.gender,
      city: profile.city,
      occupation: profile.occupation,
      bio: profile.bio,
      sleepSchedule: profile.sleepSchedule,
      atmospherePreference: profile.atmospherePreference,
      drinking: profile.drinking,
      smoking: profile.smoking,
      hasPets: profile.hasPets,
      petAttitude: profile.petAttitude,
      lifestyleTidiness: profile.lifestyleTidiness,
      interests: profile.interests,
      homeTypes: profile.homeTypes,
      spaceFeatures: profile.spaceFeatures,
      livingNeeds: profile.livingNeeds,
      travelCompanions: profile.travelCompanions,
      travelStyles: profile.travelStyles,
      cityExplorationStyles: profile.cityExplorationStyles,
      travelFrequency: profile.travelFrequency,
      languages: profile.languages,
      currentStep: profile.currentStep,
      basicInfoCompletedAt: profile.basicInfoCompletedAt,
      lifestyleCompletedAt: profile.lifestyleCompletedAt,
      accommodationTravelCompletedAt: profile.accommodationTravelCompletedAt,
      profileCompletedAt: profile.profileCompletedAt,
    };
  }

  async updateBasicInfo(
    accountId: string,
    dto: UpdateBasicInfoDto,
  ): Promise<void> {
    await this.realNameVerificationService.assertSubmitted(accountId);
    await this.getOrCreateProfile(accountId);

    await this.prisma.customerProfile.update({
      where: { accountId },
      data: {
        gender: dto.gender,
        city: dto.city,
        occupation: dto.occupation,
        bio: dto.bio,
        basicInfoCompletedAt: new Date(),
        currentStep: ProfileSetupStep.LIFESTYLE,
      },
    });
  }

  async updateLifestyle(
    accountId: string,
    dto: UpdateLifestyleDto,
  ): Promise<void> {
    const profile = await this.getOrCreateProfile(accountId);
    this.assertStepCompleted(profile.basicInfoCompletedAt, '基础信息');

    await this.prisma.customerProfile.update({
      where: { accountId },
      data: {
        sleepSchedule: dto.sleepSchedule,
        atmospherePreference: dto.atmospherePreference,
        drinking: dto.drinking,
        smoking: dto.smoking,
        hasPets: dto.hasPets,
        petAttitude: dto.petAttitude,
        lifestyleTidiness: dto.lifestyleTidiness,
        interests: dto.interests,
        lifestyleCompletedAt: new Date(),
        currentStep: ProfileSetupStep.ACCOMMODATION_TRAVEL,
      },
    });
  }

  async updateAccommodationTravel(
    accountId: string,
    dto: UpdateAccommodationTravelDto,
  ): Promise<void> {
    const profile = await this.getOrCreateProfile(accountId);
    this.assertStepCompleted(profile.lifestyleCompletedAt, '我的生活方式');

    await this.prisma.customerProfile.update({
      where: { accountId },
      data: {
        homeTypes: dto.homeTypes,
        spaceFeatures: dto.spaceFeatures,
        livingNeeds: dto.livingNeeds,
        travelCompanions: dto.travelCompanions,
        travelStyles: dto.travelStyles,
        cityExplorationStyles: dto.cityExplorationStyles,
        travelFrequency: dto.travelFrequency,
        languages: dto.languages,
        accommodationTravelCompletedAt: new Date(),
      },
    });
  }

  async complete(accountId: string): Promise<void> {
    const profile = await this.getOrCreateProfile(accountId);
    this.assertStepCompleted(
      profile.accommodationTravelCompletedAt,
      '住宿偏好与旅行风格',
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.customerProfile.update({
        where: { accountId },
        data: {
          profileCompletedAt: new Date(),
          currentStep: ProfileSetupStep.COMPLETED,
        },
      });
      await this.livingDaysService.grantIfEligible(accountId, tx);
    });
  }

  private async getOrCreateProfile(accountId: string) {
    const existing = await this.prisma.customerProfile.findUnique({
      where: { accountId },
    });
    if (existing) {
      return existing;
    }

    return this.prisma.customerProfile.create({ data: { accountId } });
  }

  private assertStepCompleted(
    completedAt: Date | null,
    stepLabel: string,
  ): void {
    if (!completedAt) {
      throw new BusinessException(
        ProfileErrorCode.PROFILE_STEP_OUT_OF_ORDER,
        `请先完成「${stepLabel}」`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
