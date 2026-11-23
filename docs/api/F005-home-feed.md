# F005 Home Feed API

OpenSpec Change：`add-home-feed`（`openspec/changes/add-home-feed/`）
对应能力：`home-feed`

运营配置完成前，首页只返回 `product/home-display-sample.md` 里的编排内容。人数、天气和相对时间都是文案，不是实时数据。

## GET /customer/home-feed

### Description

一次返回今日推荐、两条生活灵感、一条故事、一条周末计划和一条 Belong。不需要登录。

模块标题、按钮和「第一次生活交换引导」不在这个响应里，由小程序页面固定展示。

### Authentication

不需要登录。

### Response

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "today": {
      "imageKey": "today-dali",
      "place": "大理 · 中国",
      "description": "慢下来，在风花雪月里遇见生活本来的样子。",
      "tags": ["远程办公友好", "慢生活"],
      "weatherText": "23℃ 晴 · 适合生活 3-7 天",
      "livingTipTitle": "Living Tip",
      "livingTipBody": "今天适合慢下来，去一个有山有水的地方。"
    },
    "inspirations": [
      {
        "imageKey": "inspiration-qingdao",
        "title": "在海边的早晨",
        "subtitle": "青岛 · 海景公寓·7天交换体验"
      },
      {
        "imageKey": "inspiration-chengdu",
        "title": "在别人的城市",
        "subtitle": "成都 · 市中心民宿·5天交换"
      }
    ],
    "story": {
      "imageKey": "story-kyoto",
      "avatarKey": "story-luna",
      "memberName": "Luna（深圳）",
      "statusText": "在京都已经生活了 14 天",
      "quote": "我第一次知道，原来旅行和生活是不一样的。",
      "timeText": "3天前"
    },
    "weekend": {
      "imageKey": "weekend-kyoto",
      "place": "京都 · 日本",
      "watchingText": "本周 128 位会员关注",
      "startedText": "已有 12 位发起 Weekend",
      "durationText": "推荐生活时间 2-3 天"
    },
    "belong": {
      "imageKey": "belong-dali",
      "title": "大理女设计师的一天",
      "moments": [
        { "period": "早晨", "text": "早晨去海边跑步。" },
        { "period": "下午", "text": "下午在咖啡店工作。" },
        { "period": "晚上", "text": "晚上参加读书会。" }
      ]
    }
  }
}
```

`imageKey` 和 `avatarKey` 是设计稿图片的资源键。以 `https://` 开头时客户端直接显示；否则使用小程序本地的同名图片。
