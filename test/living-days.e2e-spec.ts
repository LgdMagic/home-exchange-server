import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';
import { Prisma } from '../src/generated/prisma/client.js';
import {
  BenefitPackageStatus,
  LivingExchangeStatus,
  SettlementSource,
} from '../src/generated/prisma/enums.js';
import { LivingDaysService } from '../src/modules/living-days/living-days.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  removeIdCardPhotos,
  uploadBothIdCardPhotos,
} from './support/id-card-photo.js';

/**
 * 覆盖 openspec/changes/add-living-days 的查询接口，以及走真实事务的结算。
 * 手机号段 +86 139003xxxxx，与资料、实名 e2e 分开。
 */
describe('living-days (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let livingDays: LivingDaysService;

  const COUNTRY_CODE = '+86';
  const GUEST_A_ID_CARD = '440106199404044218';
  const GUEST_B_ID_CARD = '310101198002022221';
  const SPENDER_ID_CARD = '120101199111113332';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor(new Reflector()));

    await app.init();
    prisma = app.get(PrismaService);
    livingDays = app.get(LivingDaysService);
    await cleanup();
  });

  afterAll(async () => {
    if (prisma) {
      await cleanup();
    }
    if (app) {
      await app.close();
    }
  });

  async function cleanup(): Promise<void> {
    const accounts = await prisma.account.findMany({
      where: {
        countryCode: COUNTRY_CODE,
        phoneNumber: { startsWith: '139003' },
      },
      select: { id: true },
    });
    const accountIds = accounts.map((account) => account.id);
    if (accountIds.length > 0) {
      await removeIdCardPhotos(accountIds);
      await prisma.account.deleteMany({ where: { id: { in: accountIds } } });
    }
    await prisma.phoneVerificationCode.deleteMany({
      where: {
        countryCode: COUNTRY_CODE,
        phoneNumber: { startsWith: '139003' },
      },
    });
  }

  async function login(
    phoneNumber: string,
  ): Promise<{ token: string; accountId: string }> {
    await request(app.getHttpServer())
      .post('/customer/auth/sms-code')
      .send({ countryCode: COUNTRY_CODE, phoneNumber });

    const loginResponse = await request(app.getHttpServer())
      .post('/customer/auth/login/sms')
      .send({
        countryCode: COUNTRY_CODE,
        phoneNumber,
        code: '999999',
        agreedToTerms: true,
      });
    expect(loginResponse.status).toBe(200);

    return {
      token: loginResponse.body.data.accessToken as string,
      accountId: loginResponse.body.data.account.id as string,
    };
  }

  async function submitRealName(
    token: string,
    idCardNumber: string,
  ): Promise<void> {
    await uploadBothIdCardPhotos(app.getHttpServer(), token);
    const response = await request(app.getHttpServer())
      .post('/customer/real-name-verification')
      .set('Authorization', `Bearer ${token}`)
      .send({ realName: '测试', idCardNumber });
    expect(response.status).toBe(200);
  }

  async function completeProfile(
    token: string,
    accountId: string,
  ): Promise<void> {
    await prisma.customerProfile.create({
      data: {
        accountId,
        accommodationTravelCompletedAt: new Date(),
      },
    });
    const response = await request(app.getHttpServer())
      .post('/customer/profile/complete')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
  }

  it('未登录访问返回 401', async () => {
    const response = await request(app.getHttpServer()).get(
      '/customer/living-days',
    );
    expect(response.status).toBe(401);
  });

  it('无记录时余额为 0、权益包为 null；资料完成后发放，余额仍为 0', async () => {
    const guest = await login('13900310001');
    const before = await request(app.getHttpServer())
      .get('/customer/living-days')
      .set('Authorization', `Bearer ${guest.token}`);

    expect(before.status).toBe(200);
    expect(before.body.data).toEqual({ balance: 0, benefitPackage: null });

    await submitRealName(guest.token, GUEST_A_ID_CARD);
    const afterRealName = await request(app.getHttpServer())
      .get('/customer/living-days')
      .set('Authorization', `Bearer ${guest.token}`);
    expect(afterRealName.body.data.benefitPackage).toBeNull();

    await completeProfile(guest.token, guest.accountId);
    const afterComplete = await request(app.getHttpServer())
      .get('/customer/living-days')
      .set('Authorization', `Bearer ${guest.token}`);

    expect(afterComplete.status).toBe(200);
    expect(afterComplete.body.data).toEqual({
      balance: 0,
      benefitPackage: {
        code: 'FIRST_LIVING_EXCHANGE',
        status: 'AVAILABLE',
      },
    });
    expect(
      await prisma.livingDaysAccount.findUnique({
        where: { accountId: guest.accountId },
      }),
    ).toBeNull();
  });

  it('权益包和 Living Days 不能混在一笔订单里，结算结果与设计一致', async () => {
    const guest = await login('13900310002');
    const host = await login('13900310003');
    await submitRealName(guest.token, GUEST_B_ID_CARD);
    await completeProfile(guest.token, guest.accountId);

    await expect(
      livingDays.openExchange({
        guestAccountId: guest.accountId,
        hostAccountId: guest.accountId,
        selectedDays: 1,
        settlementSource: SettlementSource.BENEFIT_PACKAGE,
      }),
    ).rejects.toMatchObject({ code: 10400 });

    await expect(
      livingDays.openExchange({
        guestAccountId: guest.accountId,
        hostAccountId: host.accountId,
        selectedDays: 3,
        settlementSource: SettlementSource.BENEFIT_PACKAGE,
      }),
    ).rejects.toMatchObject({ code: 22001 });

    const benefit = await livingDays.openExchange({
      guestAccountId: guest.accountId,
      hostAccountId: host.accountId,
      selectedDays: 2,
      settlementSource: SettlementSource.BENEFIT_PACKAGE,
    });
    await expect(
      livingDays.openExchange({
        guestAccountId: guest.accountId,
        hostAccountId: host.accountId,
        selectedDays: 1,
        settlementSource: SettlementSource.BENEFIT_PACKAGE,
      }),
    ).rejects.toMatchObject({ code: 22002 });

    await livingDays.rejectExchange(benefit.id);
    expect(
      (await livingDays.getView(guest.accountId)).benefitPackage?.status,
    ).toBe(BenefitPackageStatus.AVAILABLE);
    expect(await livingDays.getView(host.accountId)).toMatchObject({
      balance: 0,
    });

    const missed = await livingDays.openExchange({
      guestAccountId: guest.accountId,
      hostAccountId: host.accountId,
      selectedDays: 2,
      settlementSource: SettlementSource.BENEFIT_PACKAGE,
    });
    await livingDays.completeExchange(missed.id, 0);
    expect(
      (await livingDays.getView(guest.accountId)).benefitPackage?.status,
    ).toBe(BenefitPackageStatus.AVAILABLE);

    const stayed = await livingDays.openExchange({
      guestAccountId: guest.accountId,
      hostAccountId: host.accountId,
      selectedDays: 2,
      settlementSource: SettlementSource.BENEFIT_PACKAGE,
    });
    await livingDays.completeExchange(stayed.id, 1);
    await expect(
      livingDays.completeExchange(stayed.id, 1),
    ).rejects.toMatchObject({
      code: 22004,
    });

    const guestView = await request(app.getHttpServer())
      .get('/customer/living-days')
      .set('Authorization', `Bearer ${guest.token}`);
    expect(guestView.body.data).toEqual({
      balance: 0,
      benefitPackage: { code: 'FIRST_LIVING_EXCHANGE', status: 'USED' },
    });
    expect((await livingDays.getView(host.accountId)).balance).toBe(1);
    expect(
      await prisma.livingDaysLedgerEntry.count({
        where: { accountId: guest.accountId, direction: 'SPENT' },
      }),
    ).toBe(0);

    const spender = await login('13900310004');
    const spenderHost = await login('13900310005');
    await submitRealName(spender.token, SPENDER_ID_CARD);
    await completeProfile(spender.token, spender.accountId);
    await prisma.livingDaysAccount.create({
      data: { accountId: spender.accountId, balance: 5 },
    });

    const threeNights = await livingDays.openExchange({
      guestAccountId: spender.accountId,
      hostAccountId: spenderHost.accountId,
      selectedDays: 3,
      settlementSource: SettlementSource.LIVING_DAYS,
    });
    expect(
      (await livingDays.getView(spender.accountId)).benefitPackage?.status,
    ).toBe(BenefitPackageStatus.AVAILABLE);
    expect((await livingDays.getView(spender.accountId)).balance).toBe(5);

    await expect(
      livingDays.openExchange({
        guestAccountId: spender.accountId,
        hostAccountId: spenderHost.accountId,
        selectedDays: 3,
        settlementSource: SettlementSource.LIVING_DAYS,
      }),
    ).rejects.toMatchObject({ code: 22003 });
    expect((await livingDays.getView(spender.accountId)).balance).toBe(5);

    await livingDays.completeExchange(threeNights.id, 3);
    expect(await livingDays.getView(spender.accountId)).toEqual({
      balance: 2,
      benefitPackage: {
        code: 'FIRST_LIVING_EXCHANGE',
        status: BenefitPackageStatus.AVAILABLE,
      },
    });
    expect((await livingDays.getView(spenderHost.accountId)).balance).toBe(3);

    const benefitPackage = await prisma.benefitPackage.findUniqueOrThrow({
      where: {
        accountId_code: {
          accountId: spender.accountId,
          code: 'FIRST_LIVING_EXCHANGE',
        },
      },
    });
    await prisma.livingExchange.create({
      data: {
        guestAccountId: spender.accountId,
        hostAccountId: spenderHost.accountId,
        selectedDays: 1,
        settlementSource: SettlementSource.BENEFIT_PACKAGE,
        benefitPackageId: benefitPackage.id,
        status: LivingExchangeStatus.OPEN,
      },
    });
    await expect(
      prisma.livingExchange.create({
        data: {
          guestAccountId: spender.accountId,
          hostAccountId: spenderHost.accountId,
          selectedDays: 1,
          settlementSource: SettlementSource.BENEFIT_PACKAGE,
          benefitPackageId: benefitPackage.id,
          status: LivingExchangeStatus.OPEN,
        },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it('资料未完成不能开立订单', async () => {
    const guest = await login('13900310006');
    const host = await login('13900310007');

    await expect(
      livingDays.openExchange({
        guestAccountId: guest.accountId,
        hostAccountId: host.accountId,
        selectedDays: 1,
        settlementSource: SettlementSource.LIVING_DAYS,
      }),
    ).rejects.toMatchObject({ code: 21003 });
  });
});
