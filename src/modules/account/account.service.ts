import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UpdateWechatIdentityDto } from './dto/update-wechat-identity.dto.js';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async updateWechatIdentity(accountId: string, dto: UpdateWechatIdentityDto): Promise<void> {
    await this.prisma.account.update({
      where: { id: accountId },
      data: {
        ...(dto.nickname !== undefined ? { nickname: dto.nickname } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });
  }
}
