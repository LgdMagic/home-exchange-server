import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { CommonErrorCode } from '../../common/constants/error-code.js';
import { ObjectStorageService } from '../../common/storage/object-storage.service.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { detectIdCardImageType } from '../customer-profile/id-card-photo.util.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UpdateWechatIdentityDto } from './dto/update-wechat-identity.dto.js';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  async saveAvatar(accountId: string, bytes: Buffer): Promise<string> {
    if (!this.objectStorage.enabled) {
      throw new BusinessException(
        CommonErrorCode.INTERNAL_ERROR,
        '对象存储未配置',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) {
      throw new BusinessException(
        CommonErrorCode.VALIDATION_ERROR,
        '头像需为 5MB 以内的图片',
        HttpStatus.BAD_REQUEST,
      );
    }

    const contentType =
      detectIdCardImageType(bytes) ?? 'application/octet-stream';
    const extension =
      contentType === 'image/png'
        ? '.png'
        : contentType === 'image/jpeg'
          ? '.jpg'
          : '';
    const key = `avatars/${accountId}/${randomUUID()}${extension}`;
    await this.objectStorage.put(key, bytes, contentType);
    const avatarUrl = this.objectStorage.publicUrl(key);
    await this.prisma.account.update({
      where: { id: accountId },
      data: { avatarUrl },
    });
    return avatarUrl;
  }

  async updateWechatIdentity(
    accountId: string,
    dto: UpdateWechatIdentityDto,
  ): Promise<void> {
    await this.prisma.account.update({
      where: { id: accountId },
      data: {
        ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });
  }
}
