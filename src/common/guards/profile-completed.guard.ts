import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { BusinessException } from '../exceptions/business.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AccessTokenPayload } from '../../modules/auth/token.service.js';
import { ProfileErrorCode } from '../../modules/customer-profile/constants/profile-error-code.js';

/**
 * 供未来需要"资料已完成"才能访问的 Capability（如发起/参与生活交换）复用。
 * 必须搭配 `JwtAuthGuard` 一起使用（依赖 `req.user.sub`）。本次不挂载到任何现有接口，
 * 只是把"解锁判断"这件事先实现好，见 design.md「add-customer-profile-setup」Decisions 第 5 条。
 */
@Injectable()
export class ProfileCompletedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: AccessTokenPayload }>();
    const accountId = request.user?.sub;

    if (!accountId) {
      throw new Error('ProfileCompletedGuard used without JwtAuthGuard - req.user is missing');
    }

    const profile = await this.prisma.customerProfile.findUnique({
      where: { accountId },
      select: { profileCompletedAt: true },
    });

    if (!profile?.profileCompletedAt) {
      throw new BusinessException(
        ProfileErrorCode.PROFILE_NOT_COMPLETE,
        '请先完成个人资料编辑',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
