export interface AppConfig {
  app: {
    nodeEnv: string;
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
}

export default (): AppConfig => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
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
});
