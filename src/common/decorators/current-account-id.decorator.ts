import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AccessTokenPayload } from '../../modules/auth/token.service.js';

/**
 * 从已通过 JwtAuthGuard 校验的请求中取出当前登录账号 id，避免每个 Controller 方法
 * 重复解析 `req.user.sub`。必须搭配 `@UseGuards(JwtAuthGuard)` 使用。
 */
export const CurrentAccountId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<{ user?: AccessTokenPayload }>();
  const accountId = request.user?.sub;

  if (!accountId) {
    throw new Error('CurrentAccountId used without JwtAuthGuard - req.user is missing');
  }

  return accountId;
});
