import { createHash, createHmac } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  IdCardVerificationResult,
  IdCardVerifier,
} from './id-card-verifier.js';

const HOST = 'faceid.tencentcloudapi.com';
const SERVICE = 'faceid';
const ACTION = 'IdCardVerification';
const VERSION = '2018-03-01';

@Injectable()
export class TencentIdCardVerifier implements IdCardVerifier {
  private readonly logger = new Logger(TencentIdCardVerifier.name);

  constructor(private readonly configService: ConfigService) {}

  async verify(
    name: string,
    idCardNumber: string,
  ): Promise<IdCardVerificationResult> {
    const secretId = this.configService.get<string>('faceid.secretId') ?? '';
    const secretKey = this.configService.get<string>('faceid.secretKey') ?? '';
    const payload = JSON.stringify({ IdCard: idCardNumber, Name: name });
    const timestamp = Math.floor(Date.now() / 1000);
    const authorization = signTc3({
      secretId,
      secretKey,
      payload,
      timestamp,
    });

    let response: Response;
    try {
      response = await fetch(`https://${HOST}`, {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
          Host: HOST,
          'X-TC-Action': ACTION,
          'X-TC-Timestamp': String(timestamp),
          'X-TC-Version': VERSION,
        },
        body: payload,
        signal: AbortSignal.timeout(8000),
      });
    } catch (error) {
      this.logger.error(
        `IdCardVerification request failed: ${error instanceof Error ? error.name : 'unknown'}`,
      );
      return { matched: false, result: '-4' };
    }

    let body: {
      Response?: {
        Result?: string;
        RequestId?: string;
        Error?: { Code?: string };
      };
    };
    try {
      body = (await response.json()) as typeof body;
    } catch {
      this.logger.error(
        `IdCardVerification returned non-JSON, HTTP ${response.status}`,
      );
      return { matched: false, result: '-4' };
    }

    const result = body.Response;
    if (!result || result.Error || result.Result === undefined) {
      this.logger.error(
        `IdCardVerification error code=${result?.Error?.Code ?? 'none'} requestId=${result?.RequestId ?? 'none'} http=${response.status}`,
      );
      return { matched: false, result: '-4' };
    }

    this.logger.log(
      `IdCardVerification result=${result.Result} requestId=${result.RequestId ?? 'none'}`,
    );
    if (result.Result === '0') {
      return { matched: true, source: 'TENCENT_ID_CARD_VERIFICATION' };
    }
    return { matched: false, result: result.Result };
  }
}

function signTc3(input: {
  secretId: string;
  secretKey: string;
  payload: string;
  timestamp: number;
}): string {
  const date = new Date(input.timestamp * 1000).toISOString().slice(0, 10);
  const hashedPayload = sha256(input.payload);
  const canonical = [
    'POST',
    '/',
    '',
    `content-type:application/json\nhost:${HOST}\n`,
    'content-type;host',
    hashedPayload,
  ].join('\n');
  const scope = `${date}/${SERVICE}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(input.timestamp),
    scope,
    sha256(canonical),
  ].join('\n');
  const secretDate = hmac(`TC3${input.secretKey}`, date);
  const secretService = hmac(secretDate, SERVICE);
  const secretSigning = hmac(secretService, 'tc3_request');
  const signature = createHmac('sha256', secretSigning)
    .update(stringToSign)
    .digest('hex');
  return `TC3-HMAC-SHA256 Credential=${input.secretId}/${scope}, SignedHeaders=content-type;host, Signature=${signature}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}
