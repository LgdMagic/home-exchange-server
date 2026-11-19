import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AccessTokenPayload } from './token.service.js';

/**
 * 校验 `Authorization: Bearer <accessToken>`。
 *
 * 刻意拒绝 Refresh Token（payload 带 `tokenType: 'refresh'`）：Access Token 和
 * Refresh Token 不能互相冒用，见 design.md「add-customer-profile-setup」Decisions 第 2 条。
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
    });
  }

  validate(payload: AccessTokenPayload & { tokenType?: string }): AccessTokenPayload {
    if (payload.tokenType === 'refresh') {
      throw new UnauthorizedException('Refresh token cannot be used to access this resource');
    }

    return { sub: payload.sub, scope: payload.scope };
  }
}
