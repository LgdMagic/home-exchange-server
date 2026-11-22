import type { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { PiiEncryptionService } from './pii-encryption.service.js';

function createService(keyBase64: string): PiiEncryptionService {
  const configService = {
    getOrThrow: vi.fn().mockReturnValue(keyBase64),
  } as unknown as ConfigService;

  const service = new PiiEncryptionService(configService);
  service.onModuleInit();
  return service;
}

describe('PiiEncryptionService', () => {
  const validKey = randomBytes(32).toString('base64');

  it('encrypts then decrypts back to the original plaintext', () => {
    const service = createService(validKey);
    const plaintext = '110101199003078515';

    const encrypted = service.encrypt(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(service.decrypt(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext each time (random IV)', () => {
    const service = createService(validKey);
    const plaintext = '110101199003078515';

    const first = service.encrypt(plaintext);
    const second = service.encrypt(plaintext);

    expect(first).not.toBe(second);
    expect(service.decrypt(first)).toBe(plaintext);
    expect(service.decrypt(second)).toBe(plaintext);
  });

  it('throws when the ciphertext has been tampered with', () => {
    const service = createService(validKey);
    const encrypted = service.encrypt('110101199003078515');
    const tampered = `${encrypted.slice(0, -4)}AAAA`;

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('returns the same HMAC for the same plaintext and a different HMAC for another plaintext', () => {
    const service = createService(validKey);

    expect(service.hmacSha256('110101199003078515')).toBe(
      service.hmacSha256('110101199003078515'),
    );
    expect(service.hmacSha256('110101199003078515')).not.toBe(
      service.hmacSha256('440302198501011232'),
    );
  });

  it('throws at startup if the key does not decode to 32 bytes', () => {
    const shortKey = Buffer.from('too-short').toString('base64');
    expect(() => createService(shortKey)).toThrow(/32 bytes/);
  });
});
