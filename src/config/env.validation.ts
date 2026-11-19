import Joi from 'joi';

/**
 * @nestjs/config v12 的 `validationSchema` 选项要求 Standard Schema
 * （https://standardschema.dev/，例如 Zod/Valibot），Joi 并未实现该接口。
 * 因此这里改用 `validate` 自定义函数的方式接入 Joi，保持 Joi 的表达力
 * （uri/port 等内置校验），同时兼容当前 @nestjs/config 的类型约束。
 */
const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  // 未显式设置时在 configuration.ts 里回退到 NODE_ENV，这里允许留空；
  // 与 NODE_ENV 分开校验，见 configuration.ts 中 app.appEnv 的说明。
  APP_ENV: Joi.string().valid('development', 'test', 'staging', 'production').optional(),
  PORT: Joi.number().port().default(3000),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TOKEN_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TOKEN_TTL: Joi.string().default('30d'),

  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace')
    .default('info'),

  // customer-phone-auth（OpenSpec Change: add-customer-phone-login）
  AUTH_SMS_TEST_MODE: Joi.string().valid('true', 'false').default('true'),
  WECHAT_MINI_APP_ID: Joi.string().allow('').default(''),
  WECHAT_MINI_APP_SECRET: Joi.string().allow('').default(''),
  TENCENT_SMS_SECRET_ID: Joi.string().allow('').default(''),
  TENCENT_SMS_SECRET_KEY: Joi.string().allow('').default(''),
  TENCENT_SMS_SDK_APP_ID: Joi.string().allow('').default(''),
  TENCENT_SMS_SIGN_NAME: Joi.string().allow('').default(''),
  TENCENT_SMS_TEMPLATE_ID: Joi.string().allow('').default(''),

  // customer-profile（OpenSpec Change: add-customer-profile-setup）
  PII_ENCRYPTION_KEY: Joi.string().base64().required(),
}).unknown(true);

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const { error, value } = envSchema.validate(config, { abortEarly: false });

  if (error) {
    throw new Error(`Environment validation error: ${error.message}`);
  }

  return value as Record<string, unknown>;
}
