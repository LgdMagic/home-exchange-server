import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { IdCardPhotoSide } from '../../generated/prisma/enums.js';
import { PiiEncryptionService } from '../../common/crypto/pii-encryption.service.js';

const ACCOUNT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 身份证照片以 AES-256-GCM 密文落在本地目录，文件名由账号和正反面决定。
 * 目录不挂到静态资源上，接口也不返回文件地址。
 */
@Injectable()
export class IdCardPhotoStorage {
  constructor(
    private readonly configService: ConfigService,
    private readonly piiEncryptionService: PiiEncryptionService,
  ) {}

  async write(
    accountId: string,
    side: IdCardPhotoSide,
    plaintext: Buffer,
  ): Promise<void> {
    const filePath = this.filePath(accountId, side);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      this.piiEncryptionService.encryptBuffer(plaintext),
    );
  }

  private filePath(accountId: string, side: IdCardPhotoSide): string {
    if (!ACCOUNT_ID_PATTERN.test(accountId)) {
      throw new Error(
        'Refusing to store an ID card photo for a non-uuid account',
      );
    }

    const root =
      this.configService.get<string>('storage.idCardPhotoDir') ??
      path.join('storage', 'id-card-photos');
    return path.join(path.resolve(root), accountId, `${side}.bin`);
  }
}
