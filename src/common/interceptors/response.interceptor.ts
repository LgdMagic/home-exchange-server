import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { SKIP_RESPONSE_WRAP } from '../decorators/skip-response-wrap.decorator.js';

export interface ApiResponseBody<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * 统一 Response Envelope：{ code, message, data }。
 *
 * 对应 backend.md 第 27 节约定。具体业务错误码由各 Change 在实现时定义，
 * 本拦截器只负责包装"成功响应"；异常统一由 GlobalExceptionFilter 处理。
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponseBody<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponseBody<T> | T> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_RESPONSE_WRAP, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => ({
        code: 0,
        message: 'success',
        data: (data ?? null) as T,
      })),
    );
  }
}
