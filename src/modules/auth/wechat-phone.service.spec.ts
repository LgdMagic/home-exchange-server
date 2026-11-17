import type { ConfigService } from '@nestjs/config';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { AuthErrorCode } from './constants/auth-error-code.js';
import { WechatPhoneService } from './wechat-phone.service.js';

function createConfigServiceMock() {
  return {
    getOrThrow: vi.fn((key: string) => {
      if (key === 'wechat.miniAppId') return 'test-app-id';
      if (key === 'wechat.miniAppSecret') return 'test-app-secret';
      throw new Error(`unexpected config key: ${key}`);
    }),
  } as unknown as ConfigService;
}

function jsonResponse(body: unknown) {
  return { json: () => Promise.resolve(body) } as Response;
}

describe('WechatPhoneService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves and normalizes the phone number returned by WeChat', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token-123', expires_in: 7200 }))
      .mockResolvedValueOnce(
        jsonResponse({
          phone_info: { phoneNumber: '+8613800138000', purePhoneNumber: '13800138000', countryCode: '86' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const service = new WechatPhoneService(createConfigServiceMock());
    const result = await service.resolvePhoneNumber('wx-code-1');

    expect(result).toEqual({ countryCode: '+86', phoneNumber: '13800138000' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caches the access_token across calls within its TTL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token-123', expires_in: 7200 }))
      .mockResolvedValueOnce(
        jsonResponse({
          phone_info: { phoneNumber: '+8613800138000', purePhoneNumber: '13800138000', countryCode: '86' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          phone_info: { phoneNumber: '+8613900001111', purePhoneNumber: '13900001111', countryCode: '86' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const service = new WechatPhoneService(createConfigServiceMock());
    await service.resolvePhoneNumber('wx-code-1');
    await service.resolvePhoneNumber('wx-code-2');

    // 第二次调用不应再次请求 access_token（总调用次数应为 1 次 token + 2 次换手机号 = 3 次，而不是 4 次）
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws WECHAT_PHONE_AUTH_FAILED when fetching access_token fails', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ errcode: 40013, errmsg: 'invalid appid' }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new WechatPhoneService(createConfigServiceMock());

    await expect(service.resolvePhoneNumber('wx-code-1')).rejects.toMatchObject({
      code: AuthErrorCode.WECHAT_PHONE_AUTH_FAILED,
    });
  });

  it('throws WECHAT_PHONE_AUTH_FAILED when exchanging code for a phone number fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token-123', expires_in: 7200 }))
      .mockResolvedValueOnce(jsonResponse({ errcode: 40029, errmsg: 'invalid code' }));
    vi.stubGlobal('fetch', fetchMock);

    const service = new WechatPhoneService(createConfigServiceMock());

    await expect(service.resolvePhoneNumber('bad-code')).rejects.toBeInstanceOf(BusinessException);
  });
});
