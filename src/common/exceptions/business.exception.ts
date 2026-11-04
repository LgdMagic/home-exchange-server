import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 业务错误基类。
 *
 * 按 backend.md 第 28 节约定，所有业务错误必须具有稳定的 Error Code，
 * Frontend 应根据 code 而非 message 文本判断业务错误类型。
 */
export class BusinessException extends HttpException {
  constructor(
    public readonly code: number,
    message: string,
    httpStatus: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(message, httpStatus);
  }
}
