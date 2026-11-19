import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

/**
 * 敏感个人信息（如身份证号）的加解密服务。AES-256-GCM，密钥来自 PII_ENCRYPTION_KEY
 * 环境变量（32 字节 base64）。不依赖任何第三方加密库，只用 Node 内置 `crypto`。
 *
 * 存储格式：base64(iv[12] + authTag[16] + ciphertext)，单个字符串，方便直接存进一个
 * TEXT/VARCHAR 列（见 design.md「add-customer-profile-setup」Decisions 第 1 条）。
 */
@Injectable()
export class PiiEncryptionService implements OnModuleInit {
  private key!: Buffer;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const keyBase64 = this.configService.getOrThrow<string>('security.piiEncryptionKey');
    const key = Buffer.from(keyBase64, 'base64');

    if (key.length !== KEY_LENGTH_BYTES) {
      throw new Error(
        `PII_ENCRYPTION_KEY must decode to exactly ${KEY_LENGTH_BYTES} bytes (got ${key.length}). ` +
          'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
      );
    }

    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
  }

  decrypt(encoded: string): string {
    const raw = Buffer.from(encoded, 'base64');
    const iv = raw.subarray(0, IV_LENGTH_BYTES);
    const authTag = raw.subarray(IV_LENGTH_BYTES, IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);
    const ciphertext = raw.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }
}
