import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * 覆盖 openspec/changes/add-customer-phone-login 的 specs/customer-phone-auth/spec.md 场景。
 *
 * 使用独立的测试手机号段（+86 139000xxxxx），避免与手动调试/其它测试数据冲突；
 * afterAll 清理本文件创建的全部数据，保持测试数据库整洁。
 */
describe('customer-phone-auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const COUNTRY_CODE = '+86';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // 与 src/main.ts 的 bootstrap 保持一致，否则测试看到的不是真实的 API 契约
    // （默认的 createNestApplication 不会自动套用 main.ts 里注册的全局 Pipe/Filter/Interceptor）。
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    // Reflector 没有构造函数依赖，直接 new 比在测试用的 Nest 容器里 app.get() 更可靠
    // （createNestApplication 构建出的容器在某些 Nest 版本下不保证能直接解析到内部核心 Provider）。
    app.useGlobalInterceptors(new ResponseInterceptor(new Reflector()));

    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.account.deleteMany({
        where: { countryCode: COUNTRY_CODE, phoneNumber: { startsWith: '139000' } },
      });
      await prisma.phoneVerificationCode.deleteMany({
        where: { countryCode: COUNTRY_CODE, phoneNumber: { startsWith: '139000' } },
      });
    }
    if (app) {
      await app.close();
    }
  });

  function sendCode(phoneNumber: string) {
    return request(app.getHttpServer())
      .post('/customer/auth/sms-code')
      .send({ countryCode: COUNTRY_CODE, phoneNumber });
  }

  function login(phoneNumber: string, code: string, agreedToTerms = true) {
    return request(app.getHttpServer())
      .post('/customer/auth/login/sms')
      .send({ countryCode: COUNTRY_CODE, phoneNumber, code, agreedToTerms });
  }

  it('新手机号凭验证码登录即完成注册', async () => {
    const phoneNumber = '13900001001';

    const sendResponse = await sendCode(phoneNumber);
    expect(sendResponse.status).toBe(200);
    expect(sendResponse.body).toEqual({ code: 0, message: 'success', data: { cooldownSeconds: 60 } });

    const loginResponse = await login(phoneNumber, '999999');
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.code).toBe(0);
    expect(loginResponse.body.data.account).toMatchObject({
      countryCode: COUNTRY_CODE,
      phoneNumber,
      isNewAccount: true,
    });
    expect(typeof loginResponse.body.data.accessToken).toBe('string');
    expect(typeof loginResponse.body.data.refreshToken).toBe('string');
  });

  it('已有账号凭验证码登录（同一手机号第二次登录识别为同一账号）', async () => {
    const phoneNumber = '13900001002';

    await sendCode(phoneNumber);
    const firstLogin = await login(phoneNumber, '999999');
    const firstAccountId = firstLogin.body.data.account.id;

    // 直接把上一条验证码记录的 createdAt 往前拨，跳过 60 秒冷却期的真实等待
    // （效果等价于真实等待 60 秒，只是测试跑得更快）。
    await prisma.phoneVerificationCode.updateMany({
      where: { countryCode: COUNTRY_CODE, phoneNumber },
      data: { createdAt: new Date(Date.now() - 61 * 1000) },
    });

    await sendCode(phoneNumber);
    const secondLogin = await login(phoneNumber, '999999');

    expect(secondLogin.body.data.account.id).toBe(firstAccountId);
    expect(secondLogin.body.data.account.isNewAccount).toBe(false);
  });

  it('验证码错误时拒绝登录，且不创建账号', async () => {
    const phoneNumber = '13900001003';
    await sendCode(phoneNumber);

    const response = await login(phoneNumber, '000000');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(20005); // SMS_CODE_INVALID

    const account = await prisma.account.findUnique({
      where: { countryCode_phoneNumber: { countryCode: COUNTRY_CODE, phoneNumber } },
    });
    expect(account).toBeNull();
  });

  it('验证码连续输错 5 次后失效', async () => {
    const phoneNumber = '13900001004';
    await sendCode(phoneNumber);

    for (let i = 0; i < 4; i += 1) {
      const response = await login(phoneNumber, '000000');
      expect(response.body.code).toBe(20005); // SMS_CODE_INVALID
    }

    const fifthAttempt = await login(phoneNumber, '000000');
    expect(fifthAttempt.body.code).toBe(20006); // SMS_CODE_ATTEMPTS_EXCEEDED

    // 验证码已失效，即使之后提交正确验证码也应被拒绝
    const afterInvalidated = await login(phoneNumber, '999999');
    expect(afterInvalidated.body.code).toBe(20005); // 已无"活跃"验证码记录，归类为 SMS_CODE_INVALID
  });

  it('60 秒内重复请求验证码被拒绝', async () => {
    const phoneNumber = '13900001005';
    const first = await sendCode(phoneNumber);
    expect(first.body.code).toBe(0);

    const second = await sendCode(phoneNumber);
    expect(second.status).toBe(429);
    expect(second.body.code).toBe(20002); // SMS_CODE_SEND_TOO_FREQUENT
  });

  it('同一手机号 1 小时内发送超过 5 次被拒绝', async () => {
    const phoneNumber = '13900001006';

    // 直接插入 5 条"过去已发送"的记录：均超过 60 秒冷却窗口（不会误触发 20002），
    // 但都在 1 小时窗口内（触发 20003 的发送次数上限判断）。
    const now = new Date();
    await prisma.phoneVerificationCode.createMany({
      data: Array.from({ length: 5 }, (_, index) => ({
        countryCode: COUNTRY_CODE,
        phoneNumber,
        codeHash: 'test-hash-not-used',
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
        createdAt: new Date(now.getTime() - (index + 2) * 61 * 1000), // 均早于 60 秒冷却窗口
      })),
    });

    const response = await sendCode(phoneNumber);
    expect(response.status).toBe(429);
    expect(response.body.code).toBe(20003); // SMS_CODE_SEND_LIMIT_EXCEEDED
  });

  it('未同意用户协议时拒绝登录', async () => {
    const phoneNumber = '13900001007';
    await sendCode(phoneNumber);

    const response = await login(phoneNumber, '999999', false);

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(20007); // TERMS_NOT_AGREED
  });

  it('不同区号下数字相同的手机号视为不同账号', async () => {
    // "61234567" 同时符合 +853（8 位，6 开头）与 +65（8 位，3/6/8/9 开头）的格式规则，
    // 用同一串数字搭配两个不同区号分别登录，验证唯一性是「区号+手机号」组合。
    const SAME_DIGITS = '61234567';

    await request(app.getHttpServer())
      .post('/customer/auth/sms-code')
      .send({ countryCode: '+853', phoneNumber: SAME_DIGITS });
    const macauLogin = await request(app.getHttpServer())
      .post('/customer/auth/login/sms')
      .send({ countryCode: '+853', phoneNumber: SAME_DIGITS, code: '999999', agreedToTerms: true });
    expect(macauLogin.body.data.account.isNewAccount).toBe(true);

    await request(app.getHttpServer())
      .post('/customer/auth/sms-code')
      .send({ countryCode: '+65', phoneNumber: SAME_DIGITS });
    const singaporeLogin = await request(app.getHttpServer())
      .post('/customer/auth/login/sms')
      .send({ countryCode: '+65', phoneNumber: SAME_DIGITS, code: '999999', agreedToTerms: true });

    expect(singaporeLogin.body.data.account.isNewAccount).toBe(true);
    expect(singaporeLogin.body.data.account.id).not.toBe(macauLogin.body.data.account.id);

    // 清理这条跨区号测试数据（不在 +86/139000 的统一清理范围内）
    await prisma.account.deleteMany({ where: { phoneNumber: SAME_DIGITS, countryCode: { in: ['+853', '+65'] } } });
    await prisma.phoneVerificationCode.deleteMany({
      where: { phoneNumber: SAME_DIGITS, countryCode: { in: ['+853', '+65'] } },
    });
  });

  it('手机号格式不符合所选区号规则时拒绝', async () => {
    const response = await sendCode('123'); // 位数不足，且不符合 +86 号段规则

    expect(response.status).toBe(400);
  });

  it('微信一键登录：code 无效时返回 WECHAT_PHONE_AUTH_FAILED', async () => {
    const response = await request(app.getHttpServer())
      .post('/customer/auth/login/wechat-phone')
      .send({ code: 'not-a-real-wechat-code', agreedToTerms: true });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(20008); // WECHAT_PHONE_AUTH_FAILED
  });
});
