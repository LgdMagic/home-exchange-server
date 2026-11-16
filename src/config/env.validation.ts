import Joi from 'joi';

/**
 * @nestjs/config v12 的 `validationSchema` 选项要求 Standard Schema
 * （https://standardschema.dev/，例如 Zod/Valibot），Joi 并未实现该接口。
 * 因此这里改用 `validate` 自定义函数的方式接入 Joi，保持 Joi 的表达力
 * （uri/port 等内置校验），同时兼容当前 @nestjs/config 的类型约束。
 */
const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
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
}).unknown(true);

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const { error, value } = envSchema.validate(config, { abortEarly: false });

  if (error) {
    throw new Error(`Environment validation error: ${error.message}`);
  }

  return value as Record<string, unknown>;
}
