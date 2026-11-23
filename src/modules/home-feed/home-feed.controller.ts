import { Controller, Get } from '@nestjs/common';
import { HomeFeedService, type HomeFeedView } from './home-feed.service.js';

/**
 * 首页展示内容。不需要登录（Consumer=Client）。
 * 详细契约见 docs/api/F005-home-feed.md。
 */
@Controller('customer/home-feed')
export class HomeFeedController {
  constructor(private readonly homeFeedService: HomeFeedService) {}

  @Get()
  get(): HomeFeedView {
    return this.homeFeedService.getView();
  }
}
