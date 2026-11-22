import type { PrismaService } from '../../prisma/prisma.service.js';
import type { LivingDaysService } from '../living-days/living-days.service.js';
import { AuthService } from './auth.service.js';
import { AuthErrorCode } from './constants/auth-error-code.js';
import { TokenService } from './token.service.js';
import { VerificationCodeService } from './verification-code.service.js';
import { WechatPhoneService } from './wechat-phone.service.js';

interface FakeAccount {
  id: string;
  countryCode: string;
  phoneNumber: string;
  nickname: string | null;
  avatarUrl: string | null;
  termsAgreedAt: Date | null;
  termsVersion: string | null;
}

/** 轻量内存版 account 操作，足以验证 AuthService 的"查找或创建"分支逻辑，不需要真实数据库。 */
function createInMemoryAccountModel() {
  const accounts: FakeAccount[] = [];
  let idCounter = 0;

  return {
    findUnique: vi.fn(
      async ({
        where: {
          countryCode_phoneNumber: { countryCode, phoneNumber },
        },
      }: {
        where: {
          countryCode_phoneNumber: { countryCode: string; phoneNumber: string };
        };
      }) =>
        accounts.find(
          (a) => a.countryCode === countryCode && a.phoneNumber === phoneNumber,
        ) ?? null,
    ),
    create: vi.fn(
      async ({
        data,
      }: {
        data: Omit<FakeAccount, 'id' | 'nickname' | 'avatarUrl'>;
      }) => {
        idCounter += 1;
        const account: FakeAccount = {
          id: `account-${idCounter}`,
          nickname: null,
          avatarUrl: null,
          ...data,
        };
        accounts.push(account);
        return account;
      },
    ),
    update: vi.fn(
      async ({
        where: { id },
        data,
      }: {
        where: { id: string };
        data: Partial<FakeAccount>;
      }) => {
        const account = accounts.find((a) => a.id === id);
        if (!account) throw new Error(`account ${id} not found`);
        Object.assign(account, data);
        return account;
      },
    ),
  };
}

function createLivingDaysMock() {
  return {
    grantIfEligible: vi.fn().mockResolvedValue(undefined),
  } as unknown as LivingDaysService;
}

function createPrisma() {
  const account = createInMemoryAccountModel();
  const prisma = {
    account,
    $transaction: async (
      fn: (tx: { account: typeof account }) => Promise<unknown>,
    ) => fn({ account }),
  };
  return prisma as unknown as PrismaService;
}

function createVerificationCodeServiceMock() {
  return {
    verifyCode: vi.fn().mockResolvedValue(undefined),
  } as unknown as VerificationCodeService;
}

function createWechatPhoneServiceMock(result: {
  countryCode: string;
  phoneNumber: string;
}) {
  return {
    resolvePhoneNumber: vi.fn().mockResolvedValue(result),
  } as unknown as WechatPhoneService;
}

function createTokenServiceMock() {
  return {
    issueTokens: vi
      .fn()
      .mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
  } as unknown as TokenService;
}

describe('AuthService', () => {
  it('识别同一「区号+手机号」跨登录方式（短信 → 微信）为同一账号', async () => {
    const prisma = createPrisma();
    const verificationCodeService = createVerificationCodeServiceMock();
    const wechatPhoneService = createWechatPhoneServiceMock({
      countryCode: '+86',
      phoneNumber: '13800138000',
    });
    const tokenService = createTokenServiceMock();
    const service = new AuthService(
      prisma,
      verificationCodeService,
      wechatPhoneService,
      tokenService,
      createLivingDaysMock(),
    );

    const smsResult = await service.loginWithSmsCode({
      countryCode: '+86',
      phoneNumber: '13800138000',
      code: '999999',
      agreedToTerms: true,
    });
    expect(smsResult.account.isNewAccount).toBe(true);

    const wechatResult = await service.loginWithWechatPhone({
      code: 'wx-code',
      agreedToTerms: true,
    });

    expect(wechatResult.account.id).toBe(smsResult.account.id);
    expect(wechatResult.account.isNewAccount).toBe(false);
  });

  it('不同区号下数字相同的手机号视为不同账号', async () => {
    // "61234567" 同时符合 +853（8 位，6 开头）与 +65（8 位，3/6/8/9 开头）两个区号各自的格式规则，
    // 用同一串数字搭配两个不同区号，验证唯一性是「区号+手机号」组合，而不是单看手机号数字。
    const SAME_DIGITS = '61234567';
    const prisma = createPrisma();
    const verificationCodeService = createVerificationCodeServiceMock();
    const wechatPhoneService = createWechatPhoneServiceMock({
      countryCode: '+65',
      phoneNumber: SAME_DIGITS,
    });
    const tokenService = createTokenServiceMock();
    const service = new AuthService(
      prisma,
      verificationCodeService,
      wechatPhoneService,
      tokenService,
      createLivingDaysMock(),
    );

    const macauResult = await service.loginWithSmsCode({
      countryCode: '+853',
      phoneNumber: SAME_DIGITS,
      code: '999999',
      agreedToTerms: true,
    });
    const singaporeResult = await service.loginWithWechatPhone({
      code: 'wx-code',
      agreedToTerms: true,
    });

    expect(singaporeResult.account.id).not.toBe(macauResult.account.id);
    expect(singaporeResult.account.isNewAccount).toBe(true);
  });

  it('微信登录未同意协议时直接拒绝，不会调用微信接口换取手机号', async () => {
    const prisma = createPrisma();
    const verificationCodeService = createVerificationCodeServiceMock();
    const wechatPhoneService = createWechatPhoneServiceMock({
      countryCode: '+86',
      phoneNumber: '13800138000',
    });
    const tokenService = createTokenServiceMock();
    const service = new AuthService(
      prisma,
      verificationCodeService,
      wechatPhoneService,
      tokenService,
      createLivingDaysMock(),
    );

    await expect(
      service.loginWithWechatPhone({ code: 'wx-code', agreedToTerms: false }),
    ).rejects.toMatchObject({
      code: AuthErrorCode.TERMS_NOT_AGREED,
    });
    expect(wechatPhoneService.resolvePhoneNumber).not.toHaveBeenCalled();
  });
});
