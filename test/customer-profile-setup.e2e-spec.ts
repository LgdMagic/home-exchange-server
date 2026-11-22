import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  removeIdCardPhotos,
  uploadBothIdCardPhotos,
} from './support/id-card-photo.js';

/**
 * 覆盖 openspec/changes/add-customer-profile-setup 的 specs/customer-profile/spec.md 场景。
 *
 * 使用独立的测试手机号段（+86 139001xxxxx），避免与其它测试数据冲突；afterAll 清理。
 */
describe('customer-profile-setup (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const COUNTRY_CODE = '+86';
  const ID_BIRTH_1990 = '110101199003078515';
  const ID_BIRTH_1996 = '110101199608150014';
  const ID_BIRTH_1985 = '440302198501011232';
  const ID_BIRTH_1992 = '320106199201015671';

  const lifestimePayload = {
    sleepSchedule: 'EARLY_BIRD',
    atmospherePreference: 'QUIET',
    drinking: 'NONE',
    smoking: 'NONE',
    hasPets: 'NO_PETS',
    petAttitude: 'LIKE',
    lifestyleTidiness: 'TIDY',
    interests: ['READING', 'MUSIC'],
  };

  const accommodationTravelPayload = {
    homeTypes: ['APARTMENT'],
    spaceFeatures: ['BALCONY'],
    livingNeeds: ['WIFI'],
    travelCompanions: ['SOLO'],
    travelStyles: ['SLOW_TRAVEL'],
    cityExplorationStyles: ['LOCAL_SHOPS'],
    travelFrequency: 'RARELY',
    languages: ['ZH', 'EN'],
  };

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
  });

  afterAll(async () => {
    if (prisma) {
      const accounts = await prisma.account.findMany({
        where: {
          countryCode: COUNTRY_CODE,
          phoneNumber: { startsWith: '139001' },
        },
        select: { id: true },
      });
      const accountIds = accounts.map((a) => a.id);
      await removeIdCardPhotos(accountIds);
      await prisma.customerProfile.deleteMany({
        where: { accountId: { in: accountIds } },
      });
      await prisma.accountRealNameVerification.deleteMany({
        where: { accountId: { in: accountIds } },
      });
      await prisma.account.deleteMany({ where: { id: { in: accountIds } } });
      await prisma.phoneVerificationCode.deleteMany({
        where: {
          countryCode: COUNTRY_CODE,
          phoneNumber: { startsWith: '139001' },
        },
      });
    }
    if (app) {
      await app.close();
    }
  });

  /** 走一遍手机号登录流程拿到一个全新账号的 accessToken（测试期固定验证码 999999）。 */
  async function loginAsNewAccount(phoneNumber: string): Promise<string> {
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

    return loginResponse.body.data.accessToken as string;
  }

  function authed(
    method: 'get' | 'post' | 'put' | 'patch',
    path: string,
    token: string,
  ) {
    return request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${token}`);
  }

  it('未登录访问受保护接口返回 401', async () => {
    const response = await request(app.getHttpServer()).get(
      '/customer/profile',
    );
    expect(response.status).toBe(401);
  });

  it('未完成实名信息时无法提交基础信息', async () => {
    const token = await loginAsNewAccount('13900110001');

    const response = await authed(
      'put',
      '/customer/profile/basic-info',
      token,
    ).send({
      gender: 'MALE',
      city: '上海',
    });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe(21004); // REAL_NAME_NOT_SUBMITTED
    expect(response.body.message).toBe('请先提交实名信息');

    const profile = await authed('get', '/customer/profile', token);
    expect(profile.body.data.realNameStatus).toBeNull();
    expect(profile.body.data.realName).toBeNull();
  });

  it('身份证号格式不对时拒绝提交实名信息', async () => {
    const token = await loginAsNewAccount('13900110002');

    const response = await authed(
      'post',
      '/customer/real-name-verification',
      token,
    ).send({
      realName: '张三',
      idCardNumber: '110101199003078510', // 校验码错误
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(21005); // ID_CARD_NUMBER_INVALID
  });

  it('未完成前一步时不能跳到下一步', async () => {
    const token = await loginAsNewAccount('13900110003');
    await uploadBothIdCardPhotos(app.getHttpServer(), token);

    await authed('post', '/customer/real-name-verification', token).send({
      realName: '张三',
      idCardNumber: ID_BIRTH_1996,
    });

    const response = await authed(
      'put',
      '/customer/profile/lifestyle',
      token,
    ).send(lifestimePayload);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(21001); // PROFILE_STEP_OUT_OF_ORDER
  });

  it('完整走完一遍：实名占位 → 基础信息 → 生活方式 → 住宿旅行 → 完成确认', async () => {
    const phoneNumber = '13900110004';
    const token = await loginAsNewAccount(phoneNumber);
    await uploadBothIdCardPhotos(app.getHttpServer(), token);

    const realName = await authed(
      'post',
      '/customer/real-name-verification',
      token,
    ).send({
      realName: '张三',
      idCardNumber: ID_BIRTH_1990,
    });
    expect(realName.status).toBe(200);

    const basicInfo = await authed(
      'put',
      '/customer/profile/basic-info',
      token,
    ).send({
      gender: 'MALE',
      city: '上海',
      occupation: '设计师',
      bio: '喜欢旅行',
    });
    expect(basicInfo.status).toBe(200);

    const stored = await prisma.accountRealNameVerification.findFirst({
      where: { account: { phoneNumber } },
    });
    expect(stored?.realName).toBe('张三');
    expect(stored?.birthDate.toISOString().slice(0, 10)).toBe('1990-03-07');

    const lifestyle = await authed(
      'put',
      '/customer/profile/lifestyle',
      token,
    ).send(lifestimePayload);
    expect(lifestyle.status).toBe(200);

    const accommodationTravel = await authed(
      'put',
      '/customer/profile/accommodation-travel',
      token,
    ).send(accommodationTravelPayload);
    expect(accommodationTravel.status).toBe(200);

    const complete = await authed(
      'post',
      '/customer/profile/complete',
      token,
    ).send();
    expect(complete.status).toBe(200);

    const profile = await authed('get', '/customer/profile', token).send();
    expect(profile.status).toBe(200);
    expect(profile.body.data.realNameStatus).toBe('PENDING');
    expect(profile.body.data).not.toHaveProperty('realNameVerified');
    expect(profile.body.data.realName).toBe('张*'); // 脱敏，只保留姓氏
    // 手机号脱敏：13900110004（11 位）-> 前 3 后 4，中间用 * 遮盖 -> 139****0004
    expect(profile.body.data.phoneNumber).toBe('139****0004');
    expect(phoneNumber).toBe('13900110004'); // 确认上面手算的脱敏结果和实际用的手机号对得上
    expect(profile.body.data.gender).toBe('MALE');
    expect(profile.body.data.city).toBe('上海');
    expect(profile.body.data.occupation).toBe('设计师');
    expect(
      new Date(profile.body.data.birthDate as string)
        .toISOString()
        .slice(0, 10),
    ).toBe('1990-03-07');
    expect(profile.body.data.interests).toEqual(['READING', 'MUSIC']);
    expect(profile.body.data.homeTypes).toEqual(['APARTMENT']);
    expect(profile.body.data.travelFrequency).toBe('RARELY');
    expect(profile.body.data.languages).toEqual(['ZH', 'EN']);
    expect(profile.body.data.currentStep).toBe('COMPLETED');
    expect(profile.body.data.profileCompletedAt).not.toBeNull();
    // 身份证号本身绝不应该出现在任何响应里
    expect(JSON.stringify(profile.body)).not.toContain(ID_BIRTH_1990);
  });

  it('中途只完成前两步时，GET /customer/profile 能正确反映进度（支持续填）', async () => {
    const token = await loginAsNewAccount('13900110007');
    await uploadBothIdCardPhotos(app.getHttpServer(), token);

    await authed('post', '/customer/real-name-verification', token).send({
      realName: '李四',
      idCardNumber: ID_BIRTH_1985,
    });
    await authed('put', '/customer/profile/basic-info', token).send({
      gender: 'FEMALE',
      city: '北京',
    });
    await authed('put', '/customer/profile/lifestyle', token).send(
      lifestimePayload,
    );

    const profile = await authed('get', '/customer/profile', token).send();

    expect(profile.body.data.currentStep).toBe('ACCOMMODATION_TRAVEL');
    expect(profile.body.data.basicInfoCompletedAt).not.toBeNull();
    expect(profile.body.data.lifestyleCompletedAt).not.toBeNull();
    expect(profile.body.data.accommodationTravelCompletedAt).toBeNull();
    expect(profile.body.data.profileCompletedAt).toBeNull();
    expect(profile.body.data.gender).toBe('FEMALE');
  });

  it('微信昵称/头像回填后，GET /customer/profile 能读到新值', async () => {
    const token = await loginAsNewAccount('13900110005');

    const update = await authed(
      'put',
      '/customer/account/wechat-identity',
      token,
    ).send({
      nickname: '测试昵称',
    });
    expect(update.status).toBe(200);

    const updateAvatar = await authed(
      'patch',
      '/customer/account/wechat-identity',
      token,
    ).send({
      avatarUrl: 'https://example.com/avatar.png',
    });
    expect(updateAvatar.status).toBe(200);

    const profile = await authed('get', '/customer/profile', token).send();
    expect(profile.body.data.nickname).toBe('测试昵称');
    expect(profile.body.data.avatarUrl).toBe('https://example.com/avatar.png');
  });

  it('非法的单选/多选取值被拒绝（通用 10400）', async () => {
    const token = await loginAsNewAccount('13900110006');
    await uploadBothIdCardPhotos(app.getHttpServer(), token);
    await authed('post', '/customer/real-name-verification', token).send({
      realName: '张三',
      idCardNumber: ID_BIRTH_1992,
    });
    await authed('put', '/customer/profile/basic-info', token).send({
      gender: 'MALE',
      city: '上海',
    });

    const response = await authed(
      'put',
      '/customer/profile/lifestyle',
      token,
    ).send({
      ...lifestimePayload,
      sleepSchedule: 'NOT_A_REAL_OPTION',
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(10400);
  });
});
