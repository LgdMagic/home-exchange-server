/**
 * 运营配置完成前的首页展示内容。文案以 product/home-display-sample.md 为准。
 * 人数、天气、相对时间都是这段文案，不是实时数据。
 */
export const HOME_FEED_SAMPLE = {
  today: {
    imageKey: 'today-dali',
    place: '大理 · 中国',
    description: '慢下来，在风花雪月里遇见生活本来的样子。',
    tags: ['远程办公友好', '慢生活'],
    weatherText: '23℃ 晴 · 适合生活 3-7 天',
    livingTipTitle: 'Living Tip',
    livingTipBody: '今天适合慢下来，去一个有山有水的地方。',
  },
  inspirations: [
    {
      imageKey: 'inspiration-qingdao',
      title: '在海边的早晨',
      subtitle: '青岛 · 海景公寓·7天交换体验',
    },
    {
      imageKey: 'inspiration-chengdu',
      title: '在别人的城市',
      subtitle: '成都 · 市中心民宿·5天交换',
    },
  ],
  story: {
    imageKey: 'story-kyoto',
    avatarKey: 'story-luna',
    memberName: 'Luna（深圳）',
    statusText: '在京都已经生活了 14 天',
    quote: '我第一次知道，原来旅行和生活是不一样的。',
    timeText: '3天前',
  },
  weekend: {
    imageKey: 'weekend-kyoto',
    place: '京都 · 日本',
    watchingText: '本周 128 位会员关注',
    startedText: '已有 12 位发起 Weekend',
    durationText: '推荐生活时间 2-3 天',
  },
  belong: {
    imageKey: 'belong-dali',
    title: '大理女设计师的一天',
    moments: [
      { period: '早晨', text: '早晨去海边跑步。' },
      { period: '下午', text: '下午在咖啡店工作。' },
      { period: '晚上', text: '晚上参加读书会。' },
    ],
  },
} as const;
