import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentAccountId } from '../../common/decorators/current-account-id.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import type { IdCardPhotoSide } from '../../generated/prisma/enums.js';
import { IdCardPhotoAccessQueryDto } from './dto/id-card-photo-access.query.js';
import { SubmitRealNameDto } from './dto/submit-real-name.dto.js';
import { UploadIdCardPhotoDto } from './dto/upload-id-card-photo.dto.js';
import { MAX_ID_CARD_PHOTO_BYTES } from './id-card-photo.util.js';
import {
  RealNameVerificationService,
  type RealNameVerificationView,
} from './real-name-verification.service.js';

/**
 * C 端实名信息提交与查询。需要登录（Consumer=Client）。
 * 详细契约见 docs/api/F003-customer-real-name-verification.md。
 */
@Controller('customer/real-name-verification')
@UseGuards(JwtAuthGuard)
export class RealNameVerificationController {
  constructor(
    private readonly realNameVerificationService: RealNameVerificationService,
  ) {}

  @Get()
  get(
    @CurrentAccountId() accountId: string,
  ): Promise<RealNameVerificationView> {
    return this.realNameVerificationService.getView(accountId);
  }

  @Get('id-card-photo/access')
  accessPhotos(
    @CurrentAccountId() currentAccountId: string,
    @Query() query: IdCardPhotoAccessQueryDto,
  ): Promise<{
    frontUrl: string | null;
    backUrl: string | null;
    expiresIn: number;
  }> {
    return this.realNameVerificationService.accessPhotoUrls(
      query.accountId ?? currentAccountId,
    );
  }

  @Post('id-card-photo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_ID_CARD_PHOTO_BYTES } }),
  )
  async uploadPhoto(
    @CurrentAccountId() accountId: string,
    @UploadedFile() file: { buffer?: Buffer } | undefined,
    @Body() dto: UploadIdCardPhotoDto,
  ): Promise<{ uploaded: true }> {
    await this.realNameVerificationService.saveIdCardPhoto(
      accountId,
      dto.side as IdCardPhotoSide,
      file?.buffer ?? Buffer.alloc(0),
    );
    return { uploaded: true };
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async submit(
    @CurrentAccountId() accountId: string,
    @Body() dto: SubmitRealNameDto,
  ): Promise<{ success: true }> {
    await this.realNameVerificationService.submit(accountId, dto);
    return { success: true };
  }
}
