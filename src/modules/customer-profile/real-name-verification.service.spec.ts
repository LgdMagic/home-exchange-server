import type { PiiEncryptionService } from '../../common/crypto/pii-encryption.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { ProfileErrorCode } from './constants/profile-error-code.js';
import { RealNameVerificationService } from './real-name-verification.service.js';

const VALID_ID_CARD_NUMBER = '110101199003078515'; // 出生日期 1990-03-07，真实算出的合法号码

function createPrismaMock() {
  return {
    accountRealNameVerification: {
      upsert: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
    },
  } as unknown as PrismaService;
}

function createPiiEncryptionMock() {
  return {
    encrypt: vi.fn((plaintext: string) => `encrypted(${plaintext})`),
    decrypt: vi.fn(),
  } as unknown as PiiEncryptionService;
}

describe('RealNameVerificationService', () => {
  describe('submit', () => {
    it('rejects an id card number with an invalid format/check code', async () => {
      const prisma = createPrismaMock();
      const pii = createPiiEncryptionMock();
      const service = new RealNameVerificationService(prisma, pii);

      await expect(
        service.submit('account-1', { realName: '张三', idCardNumber: '110101199003078510' }),
      ).rejects.toMatchObject({ code: ProfileErrorCode.ID_CARD_NUMBER_INVALID });
      expect(prisma.accountRealNameVerification.upsert).not.toHaveBeenCalled();
    });

    it('encrypts the id card number and parses the birth date before upserting', async () => {
      const prisma = createPrismaMock();
      const pii = createPiiEncryptionMock();
      const service = new RealNameVerificationService(prisma, pii);

      await service.submit('account-1', { realName: '张三', idCardNumber: VALID_ID_CARD_NUMBER });

      expect(pii.encrypt).toHaveBeenCalledWith(VALID_ID_CARD_NUMBER);
      expect(prisma.accountRealNameVerification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accountId: 'account-1' },
          create: expect.objectContaining({
            accountId: 'account-1',
            realName: '张三',
            idCardNumberEncrypted: `encrypted(${VALID_ID_CARD_NUMBER})`,
            source: 'SELF_REPORTED',
            birthDate: new Date(Date.UTC(1990, 2, 7)),
          }),
        }),
      );
    });
  });

  describe('assertVerified', () => {
    it('returns the stored real name info when present', async () => {
      const prisma = createPrismaMock();
      const pii = createPiiEncryptionMock();
      const birthDate = new Date(Date.UTC(1990, 2, 7));
      vi.mocked(prisma.accountRealNameVerification.findUnique).mockResolvedValue({
        realName: '张三',
        birthDate,
      } as never);

      const service = new RealNameVerificationService(prisma, pii);

      await expect(service.assertVerified('account-1')).resolves.toEqual({ realName: '张三', birthDate });
    });

    it('rejects when no real name info has been submitted yet', async () => {
      const prisma = createPrismaMock();
      const pii = createPiiEncryptionMock();
      vi.mocked(prisma.accountRealNameVerification.findUnique).mockResolvedValue(null);

      const service = new RealNameVerificationService(prisma, pii);

      await expect(service.assertVerified('account-1')).rejects.toMatchObject({
        code: ProfileErrorCode.REALNAME_NOT_VERIFIED,
      });
    });
  });
});
