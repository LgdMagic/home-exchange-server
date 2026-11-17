import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { AuthErrorCode } from './constants/auth-error-code.js';
import { normalizeCountryCode } from './constants/supported-regions.js';

interface WechatAccessTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

interface WechatPhoneNumberResponse {
  errcode?: number;
  errmsg?: string;
  phone_info?: {
    phoneNumber: string;
    purePhoneNumber: string;
    countryCode: string;
  };
}

export interface WechatPhoneResult {
  countryCode: string;
  phoneNumber: string;
}

/** 提前刷新 access_token 的安全余量，避免在有效期临界点发生竞态失效 */
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 7200;

/**
 * 微信一键获取手机号登录：用 wx.getPhoneNumber 返回的 code 换取真实手机号。
 *
 * 全程服务端完成，AppSecret 不会出现在小程序端：
 * 1. 用 AppID + AppSecret 换取应用级 access_token（进程内缓存，见 design.md Risks 第 2 条：
 *    多实例部署时各实例会各自刷新，当前仅针对单实例场景，后续多实例需迁移到共享缓存）。
 * 2. 用 access_token + 小程序端传来的 code 换取手机号与区号。
 */
@Injectable()
export class WechatPhoneService {
  private readonly logger = new Logger(WechatPhoneService.name);
  private cachedAccessToken: { token: string; expiresAt: number } | undefined;

  constructor(private readonly configService: ConfigService) {}

  async resolvePhoneNumber(code: string): Promise<WechatPhoneResult> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      },
    );

    const data = (await response.json()) as WechatPhoneNumberResponse;

    if (data.errcode || !data.phone_info) {
      this.logger.warn(`WeChat getuserphonenumber failed: errcode=${data.errcode} errmsg=${data.errmsg}`);
      throw new BusinessException(
        AuthErrorCode.WECHAT_PHONE_AUTH_FAILED,
        '微信手机号授权失败，请重试',
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      // 微信返回的是不带 "+" 的纯数字区号（如 "86"），统一补齐为本项目格式（如 "+86"）
      countryCode: normalizeCountryCode(data.phone_info.countryCode),
      phoneNumber: data.phone_info.purePhoneNumber,
    };
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.cachedAccessToken && this.cachedAccessToken.expiresAt > now) {
      return this.cachedAccessToken.token;
    }

    const appId = this.configService.getOrThrow<string>('wechat.miniAppId');
    const appSecret = this.configService.getOrThrow<string>('wechat.miniAppSecret');

    const response = await fetch(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`,
    );
    const data = (await response.json()) as WechatAccessTokenResponse;

    if (!data.access_token) {
      this.logger.error(`Failed to fetch WeChat access_token: errcode=${data.errcode} errmsg=${data.errmsg}`);
      throw new BusinessException(
        AuthErrorCode.WECHAT_PHONE_AUTH_FAILED,
        '微信手机号授权失败，请重试',
        HttpStatus.BAD_REQUEST,
      );
    }

    const expiresInMs = (data.expires_in ?? DEFAULT_ACCESS_TOKEN_TTL_SECONDS) * 1000;

    this.cachedAccessToken = {
      token: data.access_token,
      expiresAt: now + expiresInMs - ACCESS_TOKEN_REFRESH_MARGIN_MS,
    };

    return this.cachedAccessToken.token;
  }
}
