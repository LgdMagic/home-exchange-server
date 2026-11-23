import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { IdCardPhotoSide } from '../../generated/prisma/enums.js';
import { PiiEncryptionService } from '../../common/crypto/pii-encryption.service.js';
import { ObjectStorageService } from '../../common/storage/object-storage.service.js';

const ACCOUNT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 身份证照片按账号和正反面保存。
 * 配置了对象存储时，原图写入私有桶 `id-cards/{accountId}/{SIDE}`，供签名地址直接打开。
 * 未配置时仍把密文写在本地目录，不挂到静态资源上。
 */
@Injectable()
export class IdCardPhotoStorage {
  constructor(
    private readonly configService: ConfigService,
    private readonly piiEncryptionService: PiiEncryptionService,
    private readonly objectStorage: ObjectStorageService,
  ) {}

  signedReadUrl(accountId: string, side: IdCardPhotoSide): string | null {
    if (!this.objectStorage.enabled) return null;
    return this.objectStorage.signedGetUrl(this.objectKey(accountId, side));
  }

  objectKey(accountId: string, side: IdCardPhotoSide): string {
    this.assertAccountId(accountId);
    return `id-cards/${accountId}/${side}`;
  }

  async write(
    accountId: string,
    side: IdCardPhotoSide,
    plaintext: Buffer,
    contentType: string,
  ): Promise<void> {
    if (this.objectStorage.enabled) {
      await this.objectStorage.put(
        this.objectKey(accountId, side),
        plaintext,
        contentType,
      );
      return;
    }

    const filePath = this.filePath(accountId, side);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      this.piiEncryptionService.encryptBuffer(plaintext),
    );
  }

  private assertAccountId(accountId: string): void {
    if (!ACCOUNT_ID_PATTERN.test(accountId)) {
      throw new Error(
        'Refusing to store an ID card photo for a non-uuid account',
      );
    }
  }

  private filePath(accountId: string, side: IdCardPhotoSide): string {
    this.assertAccountId(accountId);

    const root =
      this.configService.get<string>('storage.idCardPhotoDir') ??
      path.join('storage', 'id-card-photos');
    return path.join(path.resolve(root), accountId, `${side}.bin`);
  }
}
