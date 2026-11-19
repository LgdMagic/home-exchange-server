import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * 标记一个接口需要登录（有效 Access Token）。鉴权失败时 passport 抛出
 * UnauthorizedException，由 GlobalExceptionFilter 统一映射为通用错误码 10401。
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
