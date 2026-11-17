import type { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { SmsSender } from '../sms/sms-sender.interface.js';
import { AuthErrorCode } from './constants/auth-error-code.js';
import { VerificationCodeService } from './verification-code.service.js';

const COUNTRY_CODE = '+86';
const PHONE_NUMBER = '13800138000';

function createPrismaMock() {
  return {
    phoneVerificationCode: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  } as unknown as PrismaService;
}

function createConfigServiceMock(smsTestMode: boolean) {
  return {
    get: vi.fn().mockReturnValue(smsTestMode),
  } as unknown as ConfigService;
}

function createSmsSenderMock() {
  return { send: vi.fn().mockResolvedValue(undefined) } as unknown as SmsSender;
}

describe('VerificationCodeService', () => {
  describe('sendCode', () => {
    it('creates a verification code and sends it when there is no prior record', async () => {
      const prisma = createPrismaMock();
      const config = createConfigServiceMock(true);
      const smsSender = createSmsSenderMock();
      vi.mocked(prisma.phoneVerificationCode.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.phoneVerificationCode.count).mockResolvedValue(0);
      vi.mocked(prisma.phoneVerificationCode.create).mockResolvedValue({} as never);

      const service = new VerificationCodeService(prisma, config, smsSender);
      await service.sendCode(COUNTRY_CODE, PHONE_NUMBER);

      expect(prisma.phoneVerificationCode.create).toHaveBeenCalledOnce();
      expect(smsSender.send).toHaveBeenCalledWith(
        expect.objectContaining({ countryCode: COUNTRY_CODE, phoneNumber: PHONE_NUMBER, code: '999999' }),
      );
    });

    it('generates a random (non-fixed) code when AUTH_SMS_TEST_MODE is off', async () => {
      const prisma = createPrismaMock();
      const config = createConfigServiceMock(false);
      const smsSender = createSmsSenderMock();
      vi.mocked(prisma.phoneVerificationCode.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.phoneVerificationCode.count).mockResolvedValue(0);
      vi.mocked(prisma.phoneVerificationCode.create).mockResolvedValue({} as never);

      const service = new VerificationCodeService(prisma, config, smsSender);
      await service.sendCode(COUNTRY_CODE, PHONE_NUMBER);

      const sentCode = vi.mocked(smsSender.send).mock.calls[0]?.[0].code;
      expect(sentCode).toMatch(/^\d{6}$/);
      expect(sentCode).not.toBe('999999');
    });

    it('rejects when the last code was sent less than 60 seconds ago', async () => {
      const prisma = createPrismaMock();
      const config = createConfigServiceMock(true);
      const smsSender = createSmsSenderMock();
      vi.mocked(prisma.phoneVerificationCode.findFirst).mockResolvedValue({
        createdAt: new Date(Date.now() - 10 * 1000),
      } as never);

      const service = new VerificationCodeService(prisma, config, smsSender);

      await expect(service.sendCode(COUNTRY_CODE, PHONE_NUMBER)).rejects.toMatchObject({
        code: AuthErrorCode.SMS_CODE_SEND_TOO_FREQUENT,
      });
      expect(smsSender.send).not.toHaveBeenCalled();
    });

    it('rejects when 5 codes have already been sent within the last hour', async () => {
      const prisma = createPrismaMock();
      const config = createConfigServiceMock(true);
      const smsSender = createSmsSenderMock();
      vi.mocked(prisma.phoneVerificationCode.findFirst).mockResolvedValue({
        createdAt: new Date(Date.now() - 61 * 1000),
      } as never);
      vi.mocked(prisma.phoneVerificationCode.count).mockResolvedValue(5);

      const service = new VerificationCodeService(prisma, config, smsSender);

      await expect(service.sendCode(COUNTRY_CODE, PHONE_NUMBER)).rejects.toMatchObject({
        code: AuthErrorCode.SMS_CODE_SEND_LIMIT_EXCEEDED,
      });
      expect(smsSender.send).not.toHaveBeenCalled();
    });
  });

  describe('verifyCode', () => {
    it('rejects when there is no active code record', async () => {
      const prisma = createPrismaMock();
      const config = createConfigServiceMock(true);
      const smsSender = createSmsSenderMock();
      vi.mocked(prisma.phoneVerificationCode.findFirst).mockResolvedValue(null);

      const service = new VerificationCodeService(prisma, config, smsSender);

      await expect(service.verifyCode(COUNTRY_CODE, PHONE_NUMBER, '999999')).rejects.toMatchObject({
        code: AuthErrorCode.SMS_CODE_INVALID,
      });
    });

    it('rejects when the code has expired', async () => {
      const prisma = createPrismaMock();
      const config = createConfigServiceMock(true);
      const smsSender = createSmsSenderMock();
      vi.mocked(prisma.phoneVerificationCode.findFirst).mockResolvedValue({
        id: 'code-1',
        codeHash: await bcrypt.hash('999999', 4),
        expiresAt: new Date(Date.now() - 1000),
        attemptCount: 0,
      } as never);

      const service = new VerificationCodeService(prisma, config, smsSender);

      await expect(service.verifyCode(COUNTRY_CODE, PHONE_NUMBER, '999999')).rejects.toMatchObject({
        code: AuthErrorCode.SMS_CODE_EXPIRED,
      });
    });

    it('rejects a wrong code and increments the attempt count without invalidating it yet', async () => {
      const prisma = createPrismaMock();
      const config = createConfigServiceMock(true);
      const smsSender = createSmsSenderMock();
      vi.mocked(prisma.phoneVerificationCode.findFirst).mockResolvedValue({
        id: 'code-1',
        codeHash: await bcrypt.hash('999999', 4),
        expiresAt: new Date(Date.now() + 60 * 1000),
        attemptCount: 1,
      } as never);
      vi.mocked(prisma.phoneVerificationCode.update).mockResolvedValue({} as never);

      const service = new VerificationCodeService(prisma, config, smsSender);

      await expect(service.verifyCode(COUNTRY_CODE, PHONE_NUMBER, '000000')).rejects.toMatchObject({
        code: AuthErrorCode.SMS_CODE_INVALID,
      });
      expect(prisma.phoneVerificationCode.update).toHaveBeenCalledWith({
        where: { id: 'code-1' },
        data: { attemptCount: 2, invalidatedAt: undefined },
      });
    });

    it('invalidates the code once the 5th wrong attempt is reached', async () => {
      const prisma = createPrismaMock();
      const config = createConfigServiceMock(true);
      const smsSender = createSmsSenderMock();
      vi.mocked(prisma.phoneVerificationCode.findFirst).mockResolvedValue({
        id: 'code-1',
        codeHash: await bcrypt.hash('999999', 4),
        expiresAt: new Date(Date.now() + 60 * 1000),
        attemptCount: 4,
      } as never);
      vi.mocked(prisma.phoneVerificationCode.update).mockResolvedValue({} as never);

      const service = new VerificationCodeService(prisma, config, smsSender);

      await expect(service.verifyCode(COUNTRY_CODE, PHONE_NUMBER, '000000')).rejects.toMatchObject({
        code: AuthErrorCode.SMS_CODE_ATTEMPTS_EXCEEDED,
      });
      expect(prisma.phoneVerificationCode.update).toHaveBeenCalledWith({
        where: { id: 'code-1' },
        data: { attemptCount: 5, invalidatedAt: expect.any(Date) },
      });
    });

    it('marks the code as consumed when the correct code is submitted', async () => {
      const prisma = createPrismaMock();
      const config = createConfigServiceMock(true);
      const smsSender = createSmsSenderMock();
      vi.mocked(prisma.phoneVerificationCode.findFirst).mockResolvedValue({
        id: 'code-1',
        codeHash: await bcrypt.hash('999999', 4),
        expiresAt: new Date(Date.now() + 60 * 1000),
        attemptCount: 0,
      } as never);
      vi.mocked(prisma.phoneVerificationCode.update).mockResolvedValue({} as never);

      const service = new VerificationCodeService(prisma, config, smsSender);
      await service.verifyCode(COUNTRY_CODE, PHONE_NUMBER, '999999');

      expect(prisma.phoneVerificationCode.update).toHaveBeenCalledWith({
        where: { id: 'code-1' },
        data: { consumedAt: expect.any(Date) },
      });
    });
  });
});
