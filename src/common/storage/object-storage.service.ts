import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import COS from 'cos-nodejs-sdk-v5';

/** 私有桶里的对象。头像走 CDN 域名，身份证走短时签名地址。 */
@Injectable()
export class ObjectStorageService {
  private readonly client: COS | null;
  private readonly bucket: string;
  private readonly region: string;
  private readonly cdnBaseUrl: string;

  constructor(configService: ConfigService) {
    const secretId = configService.get<string>('storage.cos.secretId') ?? '';
    const secretKey = configService.get<string>('storage.cos.secretKey') ?? '';
    this.bucket = configService.get<string>('storage.cos.bucket') ?? '';
    this.region = configService.get<string>('storage.cos.region') ?? '';
    this.cdnBaseUrl = (
      configService.get<string>('storage.cos.cdnBaseUrl') ?? ''
    ).replace(/\/$/, '');
    this.client =
      secretId && secretKey && this.bucket && this.region
        ? new COS({ SecretId: secretId, SecretKey: secretKey })
        : null;
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const client = this.requireClient();
    await client.putObject({
      Bucket: this.bucket,
      Region: this.region,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
  }

  /** 私有对象的临时读取地址。默认 10 分钟。 */
  signedGetUrl(key: string, expiresSeconds = 600): string {
    const client = this.requireClient();
    return client.getObjectUrl({
      Bucket: this.bucket,
      Region: this.region,
      Key: key,
      Sign: true,
      Expires: expiresSeconds,
      Protocol: 'https:',
    });
  }

  /** 头像等公开展示地址。桶本身仍是私有读，要靠 CDN 回源鉴权。 */
  publicUrl(key: string): string {
    if (!this.cdnBaseUrl) {
      throw new Error('COS_CDN_BASE_URL is not configured');
    }
    return `${this.cdnBaseUrl}/${key}`;
  }

  async delete(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.deleteObject({
      Bucket: this.bucket,
      Region: this.region,
      Key: key,
    });
  }

  private requireClient(): COS {
    if (!this.client) {
      throw new Error('COS is not configured');
    }
    return this.client;
  }
}
