import { HttpStatus, Injectable } from '@nestjs/common';
import { PiiEncryptionService } from '../../common/crypto/pii-encryption.service.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ProfileErrorCode } from './constants/profile-error-code.js';
import type { SubmitRealNameDto } from './dto/submit-real-name.dto.js';
import { isValidIdCardNumber, parseBirthDateFromIdCardNumber } from './id-card.util.js';

export interface RealNameInfo {
  realName: string;
  birthDate: Date;
}

/** 本次占位方案（方案 A）里 source 字段的取值，见 design.md Decisions 第 1 条 */
const SELF_REPORTED_SOURCE = 'SELF_REPORTED';

@Injectable()
export class RealNameVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly piiEncryptionService: PiiEncryptionService,
  ) {}

  /**
   * 自报姓名 + 身份证号（方案 A 占位）。重复提交按最新一次覆盖，不保留历史版本
   * （本次占位阶段未经核验，没有需要追溯"历史自报内容"的业务价值）。
   */
  async submit(accountId: string, dto: SubmitRealNameDto): Promise<void> {
    if (!isValidIdCardNumber(dto.idCardNumber)) {
      throw new BusinessException(
        ProfileErrorCode.ID_CARD_NUMBER_INVALID,
        '身份证号格式不正确',
        HttpStatus.BAD_REQUEST,
      );
    }

    const birthDate = parseBirthDateFromIdCardNumber(dto.idCardNumber);
    const idCardNumberEncrypted = this.piiEncryptionService.encrypt(dto.idCardNumber);

    await this.prisma.accountRealNameVerification.upsert({
      where: { accountId },
      create: {
        accountId,
        realName: dto.realName,
        idCardNumberEncrypted,
        birthDate,
        source: SELF_REPORTED_SOURCE,
      },
      update: {
        realName: dto.realName,
        idCardNumberEncrypted,
        birthDate,
        source: SELF_REPORTED_SOURCE,
        verifiedAt: null,
      },
    });
  }

  async findByAccountId(accountId: string): Promise<RealNameInfo | null> {
    const record = await this.prisma.accountRealNameVerification.findUnique({
      where: { accountId },
      select: { realName: true, birthDate: true },
    });

    return record ? { realName: record.realName, birthDate: record.birthDate } : null;
  }

  async assertVerified(accountId: string): Promise<RealNameInfo> {
    const info = await this.findByAccountId(accountId);

    if (!info) {
      throw new BusinessException(
        ProfileErrorCode.REALNAME_NOT_VERIFIED,
        '请先完成实名信息填写',
        HttpStatus.FORBIDDEN,
      );
    }

    return info;
  }
}
