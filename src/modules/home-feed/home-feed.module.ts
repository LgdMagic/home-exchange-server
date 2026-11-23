import { Module } from '@nestjs/common';
import { HomeFeedController } from './home-feed.controller.js';
import { HomeFeedService } from './home-feed.service.js';

@Module({
  controllers: [HomeFeedController],
  providers: [HomeFeedService],
})
export class HomeFeedModule {}
