import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AccessTokenPayload {
  sub: string;
  scope: 'customer';
}

/**
 * 登录态签发：Access Token（短效）+ Refresh Token（长效，仅用于换取新 Access Token）。
 *
 * 均为无状态 JWT，服务端不落库存储 Token 本身。Refresh Token 当前不支持服务端主动吊销
 * （design.md Non-Goals / Open Questions 第 1 条，已与项目负责人确认按此简化实现，后续
 * 若需要"远程登出/强制下线"能力，需另立 Change 设计吊销机制）。
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async issueTokens(accountId: string): Promise<IssuedTokens> {
    const payload: AccessTokenPayload = { sub: accountId, scope: 'customer' };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.configService.get<string>('jwt.accessTokenTtl'),
    } as JwtSignOptions);

    const refreshToken = await this.jwtService.signAsync(
      { ...payload, tokenType: 'refresh' },
      { expiresIn: this.configService.get<string>('jwt.refreshTokenTtl') } as JwtSignOptions,
    );

    return { accessToken, refreshToken };
  }
}
