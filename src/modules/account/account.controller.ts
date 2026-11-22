import { Body, Controller, HttpCode, HttpStatus, Patch, Put, UseGuards } from '@nestjs/common';
import { CurrentAccountId } from '../../common/decorators/current-account-id.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { AccountService } from './account.service.js';
import { UpdateWechatIdentityDto } from './dto/update-wechat-identity.dto.js';

/**
 * 账号基础身份信息（昵称/头像）维护。Consumer=Client，需要登录。
 * 详细契约见 docs/api/F002-customer-profile-setup.md。
 */
@Controller('customer/account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  // Nest 的方法装饰器会互相覆盖，不能写在同一个函数上。
  // 微信小程序 wx.request 不支持 PATCH，所以 PUT 和 PATCH 各注册一条路由。
  @Patch('wechat-identity')
  @HttpCode(HttpStatus.OK)
  updateWechatIdentityByPatch(
    @CurrentAccountId() accountId: string,
    @Body() dto: UpdateWechatIdentityDto,
  ): Promise<{ success: true }> {
    return this.updateWechatIdentity(accountId, dto);
  }

  @Put('wechat-identity')
  @HttpCode(HttpStatus.OK)
  updateWechatIdentityByPut(
    @CurrentAccountId() accountId: string,
    @Body() dto: UpdateWechatIdentityDto,
  ): Promise<{ success: true }> {
    return this.updateWechatIdentity(accountId, dto);
  }

  private async updateWechatIdentity(
    accountId: string,
    dto: UpdateWechatIdentityDto,
  ): Promise<{ success: true }> {
    await this.accountService.updateWechatIdentity(accountId, dto);
    return { success: true };
  }
}
