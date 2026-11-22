export interface AppConfig {
  app: {
    /** Node/框架层面的运行模式，只影响日志格式等纯技术优化，不代表"这是正式生产环境" */
    nodeEnv: string;
    /**
     * 这是不是真正的生产环境（development / test / staging / production）。
     * 与 nodeEnv 分开：持续部署运行的环境（测试环境、预发环境）通常也会把 nodeEnv 设为
     * "production" 以获得框架优化，但它们不是真正的生产环境——安全类检查（例如
     * AUTH_SMS_TEST_MODE 是否允许开启）必须用 appEnv 判断，不能用 nodeEnv。
     * 未显式设置时，默认与 nodeEnv 相同（兼容本地开发场景）。
     */
    appEnv: string;
    port: number;
  };
  database: {
    url: string;
  };
  jwt: {
    secret: string;
    accessTokenTtl: string;
    refreshTokenTtl: string;
  };
  log: {
    level: string;
  };
  auth: {
    /** 测试期固定验证码开关（999999，不发送真实短信），生产环境必须为 false */
    smsTestMode: boolean;
  };
  wechat: {
    miniAppId: string;
    miniAppSecret: string;
  };
  sms: {
    tencent: {
      secretId: string;
      secretKey: string;
      sdkAppId: string;
      signName: string;
      templateId: string;
    };
  };
  security: {
    /** 32 字节 base64 密钥，用于加密身份证号等敏感个人信息（customer-profile） */
    piiEncryptionKey: string;
  };
  storage: {
    /** 身份证照片密文目录。不通过 HTTP 暴露。 */
    idCardPhotoDir: string;
  };
}

export default (): AppConfig => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    appEnv: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    accessTokenTtl: process.env.JWT_ACCESS_TOKEN_TTL ?? '15m',
    refreshTokenTtl: process.env.JWT_REFRESH_TOKEN_TTL ?? '30d',
  },
  log: {
    level: process.env.LOG_LEVEL ?? 'info',
  },
  auth: {
    smsTestMode: (process.env.AUTH_SMS_TEST_MODE ?? 'true') === 'true',
  },
  wechat: {
    miniAppId: process.env.WECHAT_MINI_APP_ID ?? '',
    miniAppSecret: process.env.WECHAT_MINI_APP_SECRET ?? '',
  },
  sms: {
    tencent: {
      secretId: process.env.TENCENT_SMS_SECRET_ID ?? '',
      secretKey: process.env.TENCENT_SMS_SECRET_KEY ?? '',
      sdkAppId: process.env.TENCENT_SMS_SDK_APP_ID ?? '',
      signName: process.env.TENCENT_SMS_SIGN_NAME ?? '',
      templateId: process.env.TENCENT_SMS_TEMPLATE_ID ?? '',
    },
  },
  security: {
    piiEncryptionKey: process.env.PII_ENCRYPTION_KEY ?? '',
  },
  storage: {
    idCardPhotoDir: process.env.ID_CARD_PHOTO_DIR ?? 'storage/id-card-photos',
  },
});
