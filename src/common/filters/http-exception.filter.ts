import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { CommonErrorCode } from '../constants/error-code.js';
import { BusinessException } from '../exceptions/business.exception.js';
import { ProfileErrorCode } from '../../modules/customer-profile/constants/profile-error-code.js';

interface ResolvedError {
  httpStatus: number;
  code: number;
  message: string;
}

/**
 * 全局异常过滤器：把任意异常统一转换为 { code, message, data: null }。
 *
 * - BusinessException：使用其自带的业务 Error Code。
 * - 其他 HttpException（校验错误、401/403/404 等）：按 HTTP Status 映射到通用 Error Code。
 * - 其他未知异常：统一归类为 50000 INTERNAL_ERROR，并记录错误日志（不泄露内部细节给客户端）。
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ url?: string; method?: string }>();

    const resolved = this.resolve(exception, request.url ?? '');

    if (resolved.httpStatus >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method ?? ''} ${request.url ?? ''} -> ${resolved.code} ${resolved.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(resolved.httpStatus).json({
      code: resolved.code,
      message: resolved.message,
      data: null,
    });
  }

  private resolve(exception: unknown, requestUrl: string): ResolvedError {
    if (exception instanceof BusinessException) {
      return {
        httpStatus: exception.getStatus(),
        code: exception.code,
        message: exception.message,
      };
    }

    if (
      exception instanceof HttpException &&
      exception.getStatus() === HttpStatus.PAYLOAD_TOO_LARGE &&
      requestUrl.includes('/customer/account/avatar')
    ) {
      return {
        httpStatus: HttpStatus.PAYLOAD_TOO_LARGE,
        code: CommonErrorCode.VALIDATION_ERROR,
        message: '头像需为 5MB 以内的图片',
      };
    }

    if (
      exception instanceof HttpException &&
      exception.getStatus() === HttpStatus.PAYLOAD_TOO_LARGE &&
      requestUrl.includes('/customer/real-name-verification/id-card-photo')
    ) {
      return {
        httpStatus: HttpStatus.PAYLOAD_TOO_LARGE,
        code: ProfileErrorCode.ID_CARD_PHOTO_INVALID,
        message: '证件照片需为 5MB 以内的 JPG 或 PNG',
      };
    }

    if (exception instanceof HttpException) {
      const httpStatus = exception.getStatus();
      const body = exception.getResponse();
      const rawMessage =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ??
            exception.message);

      return {
        httpStatus,
        code: this.mapHttpStatusToCode(httpStatus),
        message: Array.isArray(rawMessage) ? rawMessage.join('; ') : rawMessage,
      };
    }

    return {
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      code: CommonErrorCode.INTERNAL_ERROR,
      message: 'Internal server error',
    };
  }

  private mapHttpStatusToCode(httpStatus: number): number {
    switch (httpStatus) {
      case HttpStatus.BAD_REQUEST:
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return CommonErrorCode.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return CommonErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return CommonErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return CommonErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return CommonErrorCode.CONFLICT;
      default:
        return CommonErrorCode.INTERNAL_ERROR;
    }
  }
}
