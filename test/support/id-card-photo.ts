import { rm } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types.js';

/** 能通过文件头校验的最小 JPEG。 */
export const TINY_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

export async function uploadBothIdCardPhotos(
  server: App,
  token: string,
): Promise<void> {
  for (const side of ['FRONT', 'BACK'] as const) {
    const response = await request(server)
      .post('/customer/real-name-verification/id-card-photo')
      .set('Authorization', `Bearer ${token}`)
      .field('side', side)
      .attach('file', TINY_JPEG, `${side.toLowerCase()}.jpg`);

    if (response.status !== 200) {
      throw new Error(
        `upload ${side} failed: ${response.status} ${JSON.stringify(response.body)}`,
      );
    }
  }
}

export async function removeIdCardPhotos(accountIds: string[]): Promise<void> {
  await Promise.all(
    accountIds.map((accountId) =>
      rm(path.join(process.cwd(), 'storage', 'id-card-photos', accountId), {
        recursive: true,
        force: true,
      }),
    ),
  );

  const bucket = process.env.COS_BUCKET;
  const region = process.env.COS_REGION;
  const secretId = process.env.COS_SECRET_ID;
  const secretKey = process.env.COS_SECRET_KEY;
  if (!bucket || !region || !secretId || !secretKey) return;

  const { default: COS } = await import('cos-nodejs-sdk-v5');
  const cos = new COS({ SecretId: secretId, SecretKey: secretKey });
  await Promise.all(
    accountIds.flatMap((accountId) =>
      (['FRONT', 'BACK'] as const).map((side) =>
        cos
          .deleteObject({
            Bucket: bucket,
            Region: region,
            Key: `id-cards/${accountId}/${side}`,
          })
          .catch(() => undefined),
      ),
    ),
  );
}
