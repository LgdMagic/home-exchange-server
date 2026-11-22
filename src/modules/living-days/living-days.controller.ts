import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentAccountId } from '../../common/decorators/current-account-id.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import {
  LivingDaysService,
  type LivingDaysView,
} from './living-days.service.js';

/**
 * C 端 Living Days 与首次交换权益包查询。需要登录（Consumer=Client）。
 * 详细契约见 docs/api/F004-living-days.md。
 * 结算方法不在这里暴露。
 */
@Controller('customer/living-days')
@UseGuards(JwtAuthGuard)
export class LivingDaysController {
  constructor(private readonly livingDaysService: LivingDaysService) {}

  @Get()
  get(@CurrentAccountId() accountId: string): Promise<LivingDaysView> {
    return this.livingDaysService.getView(accountId);
  }
}
