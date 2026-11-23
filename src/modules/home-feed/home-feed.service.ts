import { Injectable } from '@nestjs/common';
import { HOME_FEED_SAMPLE } from './home-feed.sample.js';

export type HomeFeedView = typeof HOME_FEED_SAMPLE;

@Injectable()
export class HomeFeedService {
  getView(): HomeFeedView {
    return HOME_FEED_SAMPLE;
  }
}
