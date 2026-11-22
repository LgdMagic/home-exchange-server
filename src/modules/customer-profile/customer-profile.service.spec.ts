import type { PrismaService } from '../../prisma/prisma.service.js';
import type { LivingDaysService } from '../living-days/living-days.service.js';
import { ProfileErrorCode } from './constants/profile-error-code.js';
import { CustomerProfileService } from './customer-profile.service.js';
import type { RealNameVerificationService } from './real-name-verification.service.js';

interface FakeProfile {
  accountId: string;
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

function createEmptyProfile(accountId: string): FakeProfile {
  return {
    accountId,
    gender: null,
    city: null,
    occupation: null,
    bio: null,
    sleepSchedule: null,
    atmospherePreference: null,
    drinking: null,
    smoking: null,
    hasPets: null,
    petAttitude: null,
    lifestyleTidiness: null,
    interests: [],
    homeTypes: [],
    spaceFeatures: [],
    livingNeeds: [],
    travelCompanions: [],
    travelStyles: [],
    cityExplorationStyles: [],
    travelFrequency: null,
    languages: [],
    currentStep: 'BASIC_INFO',
    basicInfoCompletedAt: null,
    lifestyleCompletedAt: null,
    accommodationTravelCompletedAt: null,
    profileCompletedAt: null,
  };
}

function createPrismaMock(initialProfile?: FakeProfile) {
  let profile: FakeProfile | undefined = initialProfile;

  const prisma = {
    customerProfile: {
      findUnique: vi.fn(async () => profile ?? null),
      create: vi.fn(async ({ data }: { data: { accountId: string } }) => {
        profile = createEmptyProfile(data.accountId);
        return profile;
      }),
      update: vi.fn(async ({ data }: { data: Partial<FakeProfile> }) => {
        profile = { ...(profile as FakeProfile), ...data };
        return profile;
      }),
    },
    account: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        nickname: 'Nick',
        avatarUrl: 'https://example.com/avatar.png',
        phoneNumber: '13800138000',
      }),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return prisma as unknown as PrismaService;
}

function createLivingDaysMock() {
  return {
    grantIfEligible: vi.fn().mockResolvedValue(undefined),
  } as unknown as LivingDaysService;
}

function createRealNameVerificationMock(verified: boolean) {
  return {
    assertSubmitted: verified
      ? vi.fn().mockResolvedValue({
          realName: '张三',
          birthDate: new Date('1990-03-07'),
          status: 'PENDING',
        })
      : vi.fn().mockRejectedValue({
          code: ProfileErrorCode.REAL_NAME_NOT_SUBMITTED,
        }),
    findByAccountId: verified
      ? vi.fn().mockResolvedValue({
          realName: '张三',
          birthDate: new Date('1990-03-07'),
          status: 'PENDING',
        })
      : vi.fn().mockResolvedValue(null),
  } as unknown as RealNameVerificationService;
}

describe('CustomerProfileService', () => {
  describe('updateBasicInfo', () => {
    it('rejects when real-name info has not been submitted yet', async () => {
      const prisma = createPrismaMock();
      const realName = createRealNameVerificationMock(false);
      const service = new CustomerProfileService(
        prisma,
        realName,
        createLivingDaysMock(),
      );

      await expect(
        service.updateBasicInfo('account-1', {
          gender: 'MALE' as never,
          city: '上海',
        }),
      ).rejects.toMatchObject({
        code: ProfileErrorCode.REAL_NAME_NOT_SUBMITTED,
      });
    });

    it('creates the profile lazily and marks basicInfoCompletedAt on success', async () => {
      const prisma = createPrismaMock();
      const realName = createRealNameVerificationMock(true);
      const service = new CustomerProfileService(
        prisma,
        realName,
        createLivingDaysMock(),
      );

      await service.updateBasicInfo('account-1', {
        gender: 'MALE' as never,
        city: '上海',
      });

      expect(prisma.customerProfile.create).toHaveBeenCalledWith({
        data: { accountId: 'account-1' },
      });
      expect(prisma.customerProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            basicInfoCompletedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('step ordering', () => {
    it('rejects updateLifestyle when basic info is not completed', async () => {
      const prisma = createPrismaMock(createEmptyProfile('account-1'));
      const realName = createRealNameVerificationMock(true);
      const service = new CustomerProfileService(
        prisma,
        realName,
        createLivingDaysMock(),
      );

      await expect(
        service.updateLifestyle('account-1', {
          sleepSchedule: 'EARLY_BIRD',
          atmospherePreference: 'QUIET',
          drinking: 'NONE',
          smoking: 'NONE',
          hasPets: 'NO_PETS',
          petAttitude: 'LIKE',
          lifestyleTidiness: 'TIDY',
          interests: ['READING'],
        }),
      ).rejects.toMatchObject({
        code: ProfileErrorCode.PROFILE_STEP_OUT_OF_ORDER,
      });
    });

    it('allows updateLifestyle once basic info is completed, and advances the step', async () => {
      const basicInfoDone = {
        ...createEmptyProfile('account-1'),
        basicInfoCompletedAt: new Date(),
      };
      const prisma = createPrismaMock(basicInfoDone);
      const realName = createRealNameVerificationMock(true);
      const service = new CustomerProfileService(
        prisma,
        realName,
        createLivingDaysMock(),
      );

      await service.updateLifestyle('account-1', {
        sleepSchedule: 'EARLY_BIRD',
        atmospherePreference: 'QUIET',
        drinking: 'NONE',
        smoking: 'NONE',
        hasPets: 'NO_PETS',
        petAttitude: 'LIKE',
        lifestyleTidiness: 'TIDY',
        interests: ['READING'],
      });

      expect(prisma.customerProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lifestyleCompletedAt: expect.any(Date),
            currentStep: 'ACCOMMODATION_TRAVEL',
          }),
        }),
      );
    });

    it('rejects complete() when accommodation/travel step is not completed', async () => {
      const prisma = createPrismaMock(createEmptyProfile('account-1'));
      const realName = createRealNameVerificationMock(true);
      const service = new CustomerProfileService(
        prisma,
        realName,
        createLivingDaysMock(),
      );

      await expect(service.complete('account-1')).rejects.toMatchObject({
        code: ProfileErrorCode.PROFILE_STEP_OUT_OF_ORDER,
      });
    });

    it('completes the profile once all prior steps are done', async () => {
      const allDone = {
        ...createEmptyProfile('account-1'),
        basicInfoCompletedAt: new Date(),
        lifestyleCompletedAt: new Date(),
        accommodationTravelCompletedAt: new Date(),
      };
      const prisma = createPrismaMock(allDone);
      const realName = createRealNameVerificationMock(true);
      const service = new CustomerProfileService(
        prisma,
        realName,
        createLivingDaysMock(),
      );

      await service.complete('account-1');

      expect(prisma.customerProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            profileCompletedAt: expect.any(Date),
            currentStep: 'COMPLETED',
          }),
        }),
      );
    });
  });

  describe('getProfileView', () => {
    it('merges account identity, real-name info (masked), and profile fields', async () => {
      const prisma = createPrismaMock(createEmptyProfile('account-1'));
      const realName = createRealNameVerificationMock(true);
      const service = new CustomerProfileService(
        prisma,
        realName,
        createLivingDaysMock(),
      );

      const view = await service.getProfileView('account-1');

      expect(view.realNameStatus).toBe('PENDING');
      expect(view.realName).toBe('张*');
      expect(view.phoneNumber).toBe('138****8000');
      expect(view.nickname).toBe('Nick');
    });
  });
});
