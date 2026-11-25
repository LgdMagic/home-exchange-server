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
  TINY_JPEG,
  removeIdCardPhotos,
  uploadBothIdCardPhotos,
} from './support/id-card-photo.js';

/**
 * 覆盖 openspec/changes/add-customer-real-name-verification 的服务端场景。
 * 手机号段 +86 139002xxxxx，与资料 e2e 的 139001 分开，避免身份证号互相占用。
 */
describe('customer-real-name-verification (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const COUNTRY_CODE = '+86';
  const SHARED_ID_CARD_NUMBER = '330102198808083218';
  const OTHER_ID_CARD_NUMBER = '510104199512123453';

  beforeAll(async () => {
    process.env.FACEID_TEST_MODE = 'true';
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
          phoneNumber: { startsWith: '139002' },
        },
        select: { id: true },
      });
      const accountIds = accounts.map((account) => account.id);
      await removeIdCardPhotos(accountIds);
      await prisma.accountRealNameVerification.deleteMany({
        where: { accountId: { in: accountIds } },
      });
      await prisma.account.deleteMany({ where: { id: { in: accountIds } } });
      await prisma.phoneVerificationCode.deleteMany({
        where: {
          countryCode: COUNTRY_CODE,
          phoneNumber: { startsWith: '139002' },
        },
      });
    }
    if (app) {
      await app.close();
    }
  });

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

  function authed(method: 'get' | 'post', path: string, token: string) {
    return request(app.getHttpServer())
      [method](path)
      .set('Authorization', `Bearer ${token}`);
  }

  it('未提交时查询结果是未提交，响应里没有身份证号', async () => {
    const token = await loginAsNewAccount('13900210001');

    const response = await authed(
      'get',
      '/customer/real-name-verification',
      token,
    );

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      submitted: false,
      status: null,
      realName: null,
      birthDate: null,
      idCardFrontUploaded: false,
      idCardBackUploaded: false,
    });
    expect(JSON.stringify(response.body)).not.toContain('realNameVerified');
  });

  it('纯空格姓名被拒绝', async () => {
    const token = await loginAsNewAccount('13900210002');

    const response = await authed(
      'post',
      '/customer/real-name-verification',
      token,
    ).send({
      realName: '   ',
      idCardNumber: SHARED_ID_CARD_NUMBER,
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(10400);
  });

  it('提交后锁定，再次提交不改原记录；其他账号不能占用同一身份证号', async () => {
    const ownerPhone = '13900210003';
    const ownerToken = await loginAsNewAccount(ownerPhone);
    await uploadBothIdCardPhotos(app.getHttpServer(), ownerToken);
    const first = await authed(
      'post',
      '/customer/real-name-verification',
      ownerToken,
    ).send({
      realName: ' 张三 ',
      idCardNumber: '330102198808083218',
    });
    expect(first.status).toBe(200);

    const view = await authed(
      'get',
      '/customer/real-name-verification',
      ownerToken,
    );
    expect(view.body.data.submitted).toBe(true);
    expect(view.body.data.status).toBe('VERIFIED');
    expect(view.body.data.realName).toBe('张*');
    expect(view.body.data.idCardFrontUploaded).toBe(true);
    expect(view.body.data.idCardBackUploaded).toBe(true);
    expect(
      new Date(view.body.data.birthDate as string).toISOString().slice(0, 10),
    ).toBe('1988-08-08');
    expect(JSON.stringify(view.body)).not.toContain(SHARED_ID_CARD_NUMBER);
    expect(JSON.stringify(view.body)).not.toContain('realNameVerified');

    const locked = await authed(
      'post',
      '/customer/real-name-verification',
      ownerToken,
    ).send({
      realName: '李四',
      idCardNumber: OTHER_ID_CARD_NUMBER,
    });
    expect(locked.status).toBe(409);
    expect(locked.body.code).toBe(21007);

    const lockedPhoto = await request(app.getHttpServer())
      .post('/customer/real-name-verification/id-card-photo')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('side', 'FRONT')
      .attach('file', TINY_JPEG, 'front.jpg');
    expect(lockedPhoto.status).toBe(409);
    expect(lockedPhoto.body.code).toBe(21007);

    const owner = await prisma.account.findUniqueOrThrow({
      where: {
        countryCode_phoneNumber: {
          countryCode: COUNTRY_CODE,
          phoneNumber: ownerPhone,
        },
      },
    });
    const stored = await prisma.accountRealNameVerification.findUniqueOrThrow({
      where: { accountId: owner.id },
    });
    expect(stored.realName).toBe('张三');
    expect(stored.birthDate.toISOString().slice(0, 10)).toBe('1988-08-08');

    const otherToken = await loginAsNewAccount('13900210004');
    await uploadBothIdCardPhotos(app.getHttpServer(), otherToken);
    const conflict = await authed(
      'post',
      '/customer/real-name-verification',
      otherToken,
    ).send({
      realName: '王五',
      idCardNumber: SHARED_ID_CARD_NUMBER,
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe(21006);
    expect(conflict.body.message).toBe('该身份证号已被使用');
    const body = JSON.stringify(conflict.body);
    expect(body).not.toContain(owner.id);
    expect(body).not.toContain(ownerPhone);
    expect(body).not.toContain('张三');
    expect(body).not.toContain(SHARED_ID_CARD_NUMBER);
  });

  it('图片上传服务跑通前，缺照片也能提交，非图片文件也能上传', async () => {
    const token = await loginAsNewAccount('13900210005');

    const plain = await request(app.getHttpServer())
      .post('/customer/real-name-verification/id-card-photo')
      .set('Authorization', `Bearer ${token}`)
      .field('side', 'FRONT')
      .attach('file', Buffer.from('not-an-image'), 'note.txt');
    expect(plain.status).toBe(200);

    const submitted = await authed(
      'post',
      '/customer/real-name-verification',
      token,
    ).send({
      realName: '张三',
      idCardNumber: OTHER_ID_CARD_NUMBER,
    });
    expect(submitted.status).toBe(200);
  });
});
