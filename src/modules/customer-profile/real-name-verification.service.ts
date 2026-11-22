import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import {
  IdCardPhotoSide,
  RealNameVerificationStatus,
} from '../../generated/prisma/enums.js';
import { CommonErrorCode } from '../../common/constants/error-code.js';
import { PiiEncryptionService } from '../../common/crypto/pii-encryption.service.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LivingDaysService } from '../living-days/living-days.service.js';
import { ProfileErrorCode } from './constants/profile-error-code.js';
import type { SubmitRealNameDto } from './dto/submit-real-name.dto.js';
import {
  isValidIdCardNumber,
  parseBirthDateFromIdCardNumber,
} from './id-card.util.js';
import {
  detectIdCardImageType,
  MAX_ID_CARD_PHOTO_BYTES,
} from './id-card-photo.util.js';
import { IdCardPhotoStorage } from './id-card-photo.storage.js';
import { maskRealName } from './mask.util.js';

export interface RealNameInfo {
  realName: string;
  birthDate: Date;
  status: RealNameVerificationStatus;
}

export interface RealNameVerificationView {
  submitted: boolean;
  status: RealNameVerificationStatus | null;
  realName: string | null;
  birthDate: Date | null;
  idCardFrontUploaded: boolean;
  idCardBackUploaded: boolean;
}

/** 用户自报，本期不调用第三方核验。 */
const SELF_REPORTED_SOURCE = 'SELF_REPORTED';

const EMPTY_VIEW: RealNameVerificationView = {
  submitted: false,
  status: null,
  realName: null,
  birthDate: null,
  idCardFrontUploaded: false,
  idCardBackUploaded: false,
};

function isIdCardHashConflict(
  error: Prisma.PrismaClientKnownRequestError,
): boolean {
  const parts = [error.message];
  const target = error.meta?.target;

  if (typeof target === 'string') {
    parts.push(target);
  } else if (Array.isArray(target)) {
    for (const item of target) {
      if (typeof item === 'string') {
        parts.push(item);
      }
    }
  }

  // Prisma 7 的 driver adapter 把约束名放在 message 里，meta.target 可能是空的。
  const text = parts.join(' ');
  return (
    text.includes('id_card_number_hash') || text.includes('idCardNumberHash')
  );
}

@Injectable()
export class RealNameVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly piiEncryptionService: PiiEncryptionService,
    private readonly livingDaysService: LivingDaysService,
    private readonly idCardPhotoStorage: IdCardPhotoStorage,
  ) {}

  /**
   * 首次提交姓名 + 大陆身份证号，状态记为待核验。
   * 同一账号再次提交直接拒绝，不覆盖已保存的姓名、身份证号和出生日期。
   */
  async submit(accountId: string, dto: SubmitRealNameDto): Promise<void> {
    const realName = dto.realName.trim();
    if (realName.length === 0) {
      throw new BusinessException(
        CommonErrorCode.VALIDATION_ERROR,
        '请填写姓名',
        HttpStatus.BAD_REQUEST,
      );
    }

    const idCardNumber = dto.idCardNumber.trim().toUpperCase();
    if (!isValidIdCardNumber(idCardNumber)) {
      throw new BusinessException(
        ProfileErrorCode.ID_CARD_NUMBER_INVALID,
        '身份证号格式不正确',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.assertNotLocked(accountId);

    const birthDate = parseBirthDateFromIdCardNumber(idCardNumber);
    await this.assertPhotosReady(accountId);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.accountRealNameVerification.create({
          data: {
            accountId,
            realName,
            idCardNumberEncrypted:
              this.piiEncryptionService.encrypt(idCardNumber),
            idCardNumberHash:
              this.piiEncryptionService.hmacSha256(idCardNumber),
            birthDate,
            status: RealNameVerificationStatus.PENDING,
            source: SELF_REPORTED_SOURCE,
          },
        });
        await this.livingDaysService.grantIfEligible(accountId, tx);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        if (isIdCardHashConflict(error)) {
          throw new BusinessException(
            ProfileErrorCode.ID_CARD_ALREADY_BOUND,
            '该身份证号已被使用',
            HttpStatus.CONFLICT,
          );
        }

        throw this.lockedException();
      }

      throw error;
    }
  }

  /**
   * 提交前保存一面证件照片。同一面再次上传会覆盖。已提交实名后拒绝。
   * 照片只加密落盘，响应里不返回地址。
   */
  async saveIdCardPhoto(
    accountId: string,
    side: IdCardPhotoSide,
    bytes: Buffer,
  ): Promise<void> {
    await this.assertNotLocked(accountId);

    if (bytes.length === 0 || bytes.length > MAX_ID_CARD_PHOTO_BYTES) {
      throw this.invalidPhotoException();
    }

    const contentType = detectIdCardImageType(bytes);
    if (!contentType) {
      throw this.invalidPhotoException();
    }

    await this.idCardPhotoStorage.write(accountId, side, bytes);
    await this.prisma.realNameIdCardPhoto.upsert({
      where: { accountId_side: { accountId, side } },
      create: {
        accountId,
        side,
        contentType,
        byteSize: bytes.length,
      },
      update: {
        contentType,
        byteSize: bytes.length,
      },
    });
  }

  async getView(accountId: string): Promise<RealNameVerificationView> {
    const [info, photos] = await Promise.all([
      this.findByAccountId(accountId),
      this.uploadedSides(accountId),
    ]);
    if (!info) {
      return { ...EMPTY_VIEW, ...photos };
    }

    return {
      submitted: true,
      status: info.status,
      realName: maskRealName(info.realName),
      birthDate: info.birthDate,
      ...photos,
    };
  }

  async findByAccountId(accountId: string): Promise<RealNameInfo | null> {
    const record = await this.prisma.accountRealNameVerification.findUnique({
      where: { accountId },
      select: { realName: true, birthDate: true, status: true },
    });

    return record
      ? {
          realName: record.realName,
          birthDate: record.birthDate,
          status: record.status,
        }
      : null;
  }

  /** 资料第一步的前置条件：已经提交过实名信息。待核验也算已提交。 */
  async assertSubmitted(accountId: string): Promise<RealNameInfo> {
    const info = await this.findByAccountId(accountId);

    if (!info) {
      throw new BusinessException(
        ProfileErrorCode.REAL_NAME_NOT_SUBMITTED,
        '请先提交实名信息',
        HttpStatus.FORBIDDEN,
      );
    }

    return info;
  }

  private async assertNotLocked(accountId: string): Promise<void> {
    const existing = await this.prisma.accountRealNameVerification.findUnique({
      where: { accountId },
      select: { id: true },
    });
    if (existing) {
      throw this.lockedException();
    }
  }

  private async assertPhotosReady(accountId: string): Promise<void> {
    const photos = await this.uploadedSides(accountId);
    if (photos.idCardFrontUploaded && photos.idCardBackUploaded) {
      return;
    }

    const message =
      !photos.idCardFrontUploaded && !photos.idCardBackUploaded
        ? '请上传身份证人像面和国徽面'
        : photos.idCardFrontUploaded
          ? '请上传身份证国徽面'
          : '请上传身份证人像面';

    throw new BusinessException(
      ProfileErrorCode.ID_CARD_PHOTOS_REQUIRED,
      message,
      HttpStatus.BAD_REQUEST,
    );
  }

  private async uploadedSides(accountId: string): Promise<{
    idCardFrontUploaded: boolean;
    idCardBackUploaded: boolean;
  }> {
    const rows = await this.prisma.realNameIdCardPhoto.findMany({
      where: { accountId },
      select: { side: true },
    });
    const sides = new Set(rows.map((row) => row.side));
    return {
      idCardFrontUploaded: sides.has(IdCardPhotoSide.FRONT),
      idCardBackUploaded: sides.has(IdCardPhotoSide.BACK),
    };
  }

  private invalidPhotoException(): BusinessException {
    return new BusinessException(
      ProfileErrorCode.ID_CARD_PHOTO_INVALID,
      '证件照片需为 5MB 以内的 JPG 或 PNG',
      HttpStatus.BAD_REQUEST,
    );
  }

  private lockedException(): BusinessException {
    return new BusinessException(
      ProfileErrorCode.REAL_NAME_LOCKED,
      '实名信息已提交，不能修改',
      HttpStatus.CONFLICT,
    );
  }
}
