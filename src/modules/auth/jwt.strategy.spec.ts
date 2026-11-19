import type { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy.js';

function createStrategy(): JwtStrategy {
  const configService = {
    getOrThrow: vi.fn().mockReturnValue('test-secret'),
  } as unknown as ConfigService;

  return new JwtStrategy(configService);
}

describe('JwtStrategy', () => {
  it('returns the sub/scope from a valid access token payload', () => {
    const strategy = createStrategy();

    const result = strategy.validate({ sub: 'account-1', scope: 'customer' });

    expect(result).toEqual({ sub: 'account-1', scope: 'customer' });
  });

  it('rejects a payload tagged as a refresh token', () => {
    const strategy = createStrategy();

    expect(() => strategy.validate({ sub: 'account-1', scope: 'customer', tokenType: 'refresh' })).toThrow(
      UnauthorizedException,
    );
  });
});
