import { UnauthorizedException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { RealNameVerificationStatus } from '../../generated/prisma/enums.js';
import type { PiiEncryptionService } from '../../common/crypto/pii-encryption.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { LivingDaysService } from '../living-days/living-days.service.js';
import { ProfileErrorCode } from './constants/profile-error-code.js';
import type { IdCardPhotoStorage } from './id-card-photo.storage.js';
import { RealNameVerificationService } from './real-name-verification.service.js';

const VALID_ID_CARD_NUMBER = '110101199003078515'; // 出生日期 1990-03-07
const LOWERCASE_X_ID_CARD_NUMBER = '11010119900307854x';
const OTHER_VALID_ID_CARD_NUMBER = '440302198501011232';

function createPrismaMock() {
  const prisma = {
    account: {
      findUnique: vi.fn().mockResolvedValue({ id: 'account-1' }),
    },
    accountRealNameVerification: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    realNameIdCardPhoto: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ side: 'FRONT' }, { side: 'BACK' }]),
    },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(
    async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
  );
  return prisma as unknown as PrismaService;
}

function livingDaysMock() {
  return {
    grantIfEligible: vi.fn().mockResolvedValue(undefined),
  } as unknown as LivingDaysService;
}

function idCardVerifierMock() {
  return {
    verify: vi.fn().mockResolvedValue({
      matched: true,
      source: 'TENCENT_ID_CARD_VERIFICATION',
    }),
  } as unknown as import('./id-card-verifier.js').IdCardVerifier;
}

function photoStorageMock() {
  return {
    write: vi.fn().mockResolvedValue(undefined),
  } as unknown as IdCardPhotoStorage;
}

function createPiiEncryptionMock() {
  return {
    encrypt: vi.fn((plaintext: string) => `encrypted(${plaintext})`),
    hmacSha256: vi.fn((plaintext: string) => `hmac(${plaintext})`),
  } as unknown as PiiEncryptionService;
}

function uniqueConflict(target: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: [target] },
  });
}

describe('RealNameVerificationService', () => {
  describe('submit', () => {
    it('rejects a name that is only whitespace', async () => {
      const prisma = createPrismaMock();
      const pii = createPiiEncryptionMock();
      const service = new RealNameVerificationService(
        prisma,
        pii,
        livingDaysMock(),
        photoStorageMock(),
        idCardVerifierMock(),
      );

      await expect(
        service.submit('account-1', {
          realName: '   ',
          idCardNumber: VALID_ID_CARD_NUMBER,
        }),
      ).rejects.toMatchObject({ code: 10400 });
      expect(prisma.accountRealNameVerification.create).not.toHaveBeenCalled();
    });

    it('rejects an id card number with an invalid format/check code', async () => {
      const prisma = createPrismaMock();
      const pii = createPiiEncryptionMock();
      const service = new RealNameVerificationService(
        prisma,
        pii,
        livingDaysMock(),
        photoStorageMock(),
        idCardVerifierMock(),
      );

      await expect(
        service.submit('account-1', {
          realName: '张三',
          idCardNumber: '110101199003078510',
        }),
      ).rejects.toMatchObject({
        code: ProfileErrorCode.ID_CARD_NUMBER_INVALID,
      });
      expect(prisma.accountRealNameVerification.create).not.toHaveBeenCalled();
    });

    it('stores pending status, ciphertext, and a deterministic hash on the first submit', async () => {
      const prisma = createPrismaMock();
      const pii = createPiiEncryptionMock();
      const service = new RealNameVerificationService(
        prisma,
        pii,
        livingDaysMock(),
        photoStorageMock(),
        idCardVerifierMock(),
      );

      await service.submit('account-1', {
        realName: ' 张三 ',
        idCardNumber: LOWERCASE_X_ID_CARD_NUMBER,
      });

      expect(pii.encrypt).toHaveBeenCalledWith('11010119900307854X');
      expect(pii.hmacSha256).toHaveBeenCalledWith('11010119900307854X');
      expect(prisma.accountRealNameVerification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          accountId: 'account-1',
          realName: '张三',
          idCardNumberEncrypted: 'encrypted(11010119900307854X)',
          idCardNumberHash: 'hmac(11010119900307854X)',
          source: 'TENCENT_ID_CARD_VERIFICATION',
          status: RealNameVerificationStatus.VERIFIED,
          verifiedAt: expect.any(Date),
          birthDate: new Date(Date.UTC(1990, 2, 7)),
        }),
      });
    });

    it('does not save the record when the name and id card do not match', async () => {
      const prisma = createPrismaMock();
      const verifier = idCardVerifierMock();
      vi.mocked(verifier.verify).mockResolvedValue({
        matched: false,
        result: '-1',
      });
      const service = new RealNameVerificationService(
        prisma,
        createPiiEncryptionMock(),
        livingDaysMock(),
        photoStorageMock(),
        verifier,
      );

      await expect(
        service.submit('account-1', {
          realName: '张三',
          idCardNumber: VALID_ID_CARD_NUMBER,
        }),
      ).rejects.toMatchObject({
        code: ProfileErrorCode.ID_CARD_NAME_MISMATCH,
      });
      expect(prisma.accountRealNameVerification.create).not.toHaveBeenCalled();
    });

    it('rejects a second submit for the same account without writing again', async () => {
      const prisma = createPrismaMock();
      const pii = createPiiEncryptionMock();
      vi.mocked(
        prisma.accountRealNameVerification.findUnique,
      ).mockResolvedValue({ id: 'existing' } as never);
      const service = new RealNameVerificationService(
        prisma,
        pii,
        livingDaysMock(),
        photoStorageMock(),
        idCardVerifierMock(),
      );

      await expect(
        service.submit('account-1', {
          realName: '李四',
          idCardNumber: OTHER_VALID_ID_CARD_NUMBER,
        }),
      ).rejects.toMatchObject({ code: ProfileErrorCode.REAL_NAME_LOCKED });
      expect(prisma.accountRealNameVerification.create).not.toHaveBeenCalled();
    });

    it('allows submit while id card photos are not required', async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.realNameIdCardPhoto.findMany).mockResolvedValue([]);
      const service = new RealNameVerificationService(
        prisma,
        createPiiEncryptionMock(),
        livingDaysMock(),
        photoStorageMock(),
        idCardVerifierMock(),
      );

      await service.submit('account-1', {
        realName: '张三',
        idCardNumber: VALID_ID_CARD_NUMBER,
      });

      expect(prisma.accountRealNameVerification.create).toHaveBeenCalled();
    });

    it('rejects a photo upload when the account has been removed', async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.account.findUnique).mockResolvedValue(null);
      const storage = photoStorageMock();
      const service = new RealNameVerificationService(
        prisma,
        createPiiEncryptionMock(),
        livingDaysMock(),
        storage,
        idCardVerifierMock(),
      );

      await expect(
        service.saveIdCardPhoto(
          'missing-account',
          'FRONT',
          Buffer.from([0xff, 0xd8, 0xff]),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(storage.write).not.toHaveBeenCalled();
    });

    it('maps an id-card hash conflict to already-bound without including another account', async () => {
      const prisma = createPrismaMock();
      const pii = createPiiEncryptionMock();
      vi.mocked(prisma.accountRealNameVerification.create).mockRejectedValue(
        uniqueConflict('id_card_number_hash'),
      );
      const service = new RealNameVerificationService(
        prisma,
        pii,
        livingDaysMock(),
        photoStorageMock(),
        idCardVerifierMock(),
      );

      await expect(
        service.submit('account-2', {
          realName: '李四',
          idCardNumber: VALID_ID_CARD_NUMBER,
        }),
      ).rejects.toMatchObject({
        code: ProfileErrorCode.ID_CARD_ALREADY_BOUND,
        message: '该身份证号已被使用',
      });
    });

    it('recognizes the hash constraint when Prisma only puts it in the error message', async () => {
      const prisma = createPrismaMock();
      const pii = createPiiEncryptionMock();
      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the constraint: `account_real_name_verifications_id_card_number_hash_key`',
        { code: 'P2002', clientVersion: 'test' },
      );
      vi.mocked(prisma.accountRealNameVerification.create).mockRejectedValue(
        error,
      );
      const service = new RealNameVerificationService(
        prisma,
        pii,
        livingDaysMock(),
        photoStorageMock(),
        idCardVerifierMock(),
      );

      await expect(
        service.submit('account-2', {
          realName: '李四',
          idCardNumber: VALID_ID_CARD_NUMBER,
        }),
      ).rejects.toMatchObject({ code: ProfileErrorCode.ID_CARD_ALREADY_BOUND });
    });

    it('treats a concurrent insert for the same account as locked', async () => {
      const prisma = createPrismaMock();
      const pii = createPiiEncryptionMock();
      vi.mocked(prisma.accountRealNameVerification.create).mockRejectedValue(
        uniqueConflict('account_id'),
      );
      const service = new RealNameVerificationService(
        prisma,
        pii,
        livingDaysMock(),
        photoStorageMock(),
        idCardVerifierMock(),
      );

      await expect(
        service.submit('account-1', {
          realName: '张三',
          idCardNumber: VALID_ID_CARD_NUMBER,
        }),
      ).rejects.toMatchObject({ code: ProfileErrorCode.REAL_NAME_LOCKED });
    });
  });

  describe('getView', () => {
    it('returns an empty view before anything is submitted', async () => {
      const prisma = createPrismaMock();
      vi.mocked(prisma.realNameIdCardPhoto.findMany).mockResolvedValue([]);
      const service = new RealNameVerificationService(
        prisma,
        createPiiEncryptionMock(),
        livingDaysMock(),
        photoStorageMock(),
        idCardVerifierMock(),
      );

      await expect(service.getView('account-1')).resolves.toEqual({
        submitted: false,
        status: null,
        realName: null,
        birthDate: null,
        idCardFrontUploaded: false,
        idCardBackUploaded: false,
      });
    });

    it('returns pending status and a masked name after submit', async () => {
      const prisma = createPrismaMock();
      const birthDate = new Date(Date.UTC(1990, 2, 7));
      vi.mocked(
        prisma.accountRealNameVerification.findUnique,
      ).mockResolvedValue({
        realName: '张三',
        birthDate,
        status: RealNameVerificationStatus.PENDING,
      } as never);
      const service = new RealNameVerificationService(
        prisma,
        createPiiEncryptionMock(),
        livingDaysMock(),
        photoStorageMock(),
        idCardVerifierMock(),
      );

      await expect(service.getView('account-1')).resolves.toEqual({
        submitted: true,
        status: RealNameVerificationStatus.PENDING,
        realName: '张*',
        birthDate,
        idCardFrontUploaded: true,
        idCardBackUploaded: true,
      });
    });
  });

  describe('assertSubmitted', () => {
    it('returns the stored real name info when present', async () => {
      const prisma = createPrismaMock();
      const birthDate = new Date(Date.UTC(1990, 2, 7));
      vi.mocked(
        prisma.accountRealNameVerification.findUnique,
      ).mockResolvedValue({
        realName: '张三',
        birthDate,
        status: RealNameVerificationStatus.PENDING,
      } as never);

      const service = new RealNameVerificationService(
        prisma,
        createPiiEncryptionMock(),
        livingDaysMock(),
        photoStorageMock(),
        idCardVerifierMock(),
      );

      await expect(service.assertSubmitted('account-1')).resolves.toEqual({
        realName: '张三',
        birthDate,
        status: RealNameVerificationStatus.PENDING,
      });
    });

    it('rejects when no real name info has been submitted yet', async () => {
      const prisma = createPrismaMock();
      const service = new RealNameVerificationService(
        prisma,
        createPiiEncryptionMock(),
        livingDaysMock(),
        photoStorageMock(),
        idCardVerifierMock(),
      );

      await expect(service.assertSubmitted('account-1')).rejects.toMatchObject({
        code: ProfileErrorCode.REAL_NAME_NOT_SUBMITTED,
        message: '请先提交实名信息',
      });
    });
  });
});
