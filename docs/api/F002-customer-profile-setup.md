# F002 Customer Profile Setup API

OpenSpec Change：`add-customer-profile-setup`（`openspec/changes/add-customer-profile-setup/`）
对应能力：`customer-profile`

**全部接口都需要登录**：请求头 `Authorization: Bearer <accessToken>`（登录接口见 F001）。

> ⚠️ **实名认证说明**：当前阶段"实名"是用户自报（姓名 + 身份证号，仅做格式与校验码校验），**未经公安/OCR 真实核验**。身份证号本身加密存储（AES-256-GCM），不落明文，也绝不会出现在任何接口响应里；出生日期从身份证号解析得出，单独存储用于展示。真实实名认证能力上线后，这套过渡方案会被替换，不影响本文档描述的接口契约。

## 字段取值说明

单选/多选字段使用英文代码（不是中文文案本身），前端需要维护 代码 → 中文标签 的映射：

| 字段 | 取值 | 对应中文 |
|---|---|---|
| `gender` | `MALE` \| `FEMALE` | 男 / 女 |
| `sleepSchedule` | `EARLY_BIRD` \| `REGULAR` \| `NIGHT_OWL` | 早睡早起 / 规律作息 / 夜猫子 |
| `atmospherePreference` | `QUIET` \| `CASUAL` \| `LIVELY` | 安静 / 随性 / 热闹 |
| `drinking` / `smoking` | `NONE` \| `OCCASIONAL` \| `FREQUENT` | 不饮酒(不吸烟) / 偶尔 / 经常 |
| `hasPets` | `HAS_PETS` \| `NO_PETS` | 有宠物 / 没有宠物 |
| `petAttitude` | `LIKE` \| `ACCEPTABLE` \| `DISLIKE` | 喜欢 / 可以接受 / 不太接受 |
| `lifestyleTidiness` | `TIDY` \| `CLEAN_ENOUGH` \| `CASUAL` | 整洁有序 / 干净即可 / 随性自然 |
| `interests`（多选） | `PHOTOGRAPHY` `HIKING` `COFFEE` `READING` `MUSIC` `ART` `TRAVEL` `COOKING` `MOVIES` `CYCLING` `CAMPING` `CITY_WALK` | 摄影/徒步/咖啡/阅读/音乐/艺术/旅行/做饭/电影/骑行/露营/城市漫游 |
| `homeTypes`（多选） | `URBAN_RESIDENCE` `APARTMENT` `GARDEN_HOUSE` `LOFT_DUPLEX` `VILLA_TOWNHOUSE` `COURTYARD` `HERITAGE_HOUSE` `UNIQUE_STAY` | 城市住宅/公寓/花园洋房/复式LOFT/独栋联排别墅/院落四合院/老洋房老宅/特色住宅 |
| `spaceFeatures`（多选） | `YARD` `PLANTS_FLOWERS` `BALCONY` `TERRACE` `QUIET` `GOOD_LIGHT` `GOOD_VENTILATION` `NATURE_VIEW` `KITCHEN` `OUTDOOR_SPACE` | 有院子/有鲜花植物/有阳台/有露台/安静/采光好/通风好/有自然景观/有厨房/有户外空间 |
| `livingNeeds`（多选） | `SMOKE_FREE` `SOFT_BED` `KITCHEN` `WIFI` `WASHING_MACHINE` `LONG_TERM_FRIENDLY` `PET_FRIENDLY` | 无烟/喜欢软床/有厨房/有WiFi/有洗衣机/适合长住/宠物友好 |
| `travelCompanions`（多选） | `SOLO` `WITH_FRIENDS` `WITH_PARTNER` `WITH_FAMILY` | 独自旅行/和朋友一起/和伴侣一起/和家人一起 |
| `travelStyles`（多选） | `SLOW_TRAVEL` `CITY_WALK` `FOOD_EXPLORATION` `NATURE_EXPLORATION` `CULTURAL_EXPERIENCE` `PHOTOGRAPHY` `OUTDOOR` `WEEKEND_TRIP` | 慢旅行/城市漫游/美食探索/自然探索/文化体验/摄影/户外/周末短途 |
| `cityExplorationStyles`（多选） | `LIVE_LIKE_LOCAL` `LOCAL_SHOPS` `FAVORITE_CAFE` `MEET_LOCALS` `EXPLORE_ON_FOOT` `EXHIBITIONS_SHOWS` | 像当地人一样生活/逛当地的小店/找一家喜欢的咖啡馆/认识当地的人/徒步探索城市/看展览看演出 |
| `travelFrequency` | `RARELY` `TWO_TO_THREE_PER_YEAR` `FOUR_TO_SIX_PER_YEAR` `FREQUENT` | 偶尔/每年2-3次/每年4-6次/经常旅行 |
| `languages`（多选） | `ZH` `EN` `JA` `KO` `OTHER` | 中文/英语/日语/韩语/其他 |
| `city` | 任意非空字符串，或固定值 `"OTHER"` | 国内城市清单由前端维护；选择"其他"传 `"OTHER"` |

## GET /customer/profile

### Description

获取当前账号的个人资料（惰性创建：首次访问自动初始化一条空记录）。

### Authentication

Required（Bearer Access Token）

### Response

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "realNameVerified": true,
    "realName": "张*",
    "birthDate": "1990-03-07T00:00:00.000Z",
    "phoneNumber": "138****8000",
    "nickname": "Nick",
    "avatarUrl": "https://example.com/avatar.png",
    "gender": "MALE",
    "city": "上海",
    "occupation": "设计师",
    "bio": "喜欢旅行",
    "sleepSchedule": "EARLY_BIRD",
    "atmospherePreference": "QUIET",
    "drinking": "NONE",
    "smoking": "NONE",
    "hasPets": "NO_PETS",
    "petAttitude": "LIKE",
    "lifestyleTidiness": "TIDY",
    "interests": ["READING", "MUSIC"],
    "homeTypes": ["APARTMENT"],
    "spaceFeatures": ["BALCONY"],
    "livingNeeds": ["WIFI"],
    "travelCompanions": ["SOLO"],
    "travelStyles": ["SLOW_TRAVEL"],
    "cityExplorationStyles": ["LOCAL_SHOPS"],
    "travelFrequency": "RARELY",
    "languages": ["ZH", "EN"],
    "currentStep": "COMPLETED",
    "basicInfoCompletedAt": "...",
    "lifestyleCompletedAt": "...",
    "accommodationTravelCompletedAt": "...",
    "profileCompletedAt": "..."
  }
}
```

`realName`/`phoneNumber` 始终是脱敏后的值；`realNameVerified=false` 或未完成某一步时，对应字段为 `null`。

---

## POST /customer/profile/real-name-placeholder

### Description

自报真实姓名 + 身份证号（实名认证过渡占位，见上方说明）。重复提交按最新一次覆盖。

### Request

| Field | Type | Required | Description |
|---|---|---|---|
| realName | string | Yes | 2-30 字符 |
| idCardNumber | string | Yes | 18 位，含校验码 |

### Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| 21005 | 400 | 身份证号格式或校验码不正确 |

---

## PUT /customer/profile/basic-info

### Description

提交第 1 步：基础信息。

### Request

| Field | Type | Required | Description |
|---|---|---|---|
| gender | string | Yes | `MALE` \| `FEMALE` |
| city | string | Yes | 城市名称/code，或 `"OTHER"` |
| occupation | string | No | 最长 100 字符 |
| bio | string | No | 最长 500 字符 |

### Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| 21004 | 403 | 尚未提交实名信息（见 real-name-placeholder） |

---

## PUT /customer/profile/lifestyle

### Description

提交第 2 步：我的生活方式。全部字段必填。

### Request

| Field | Type | Required |
|---|---|---|
| sleepSchedule | string | Yes |
| atmospherePreference | string | Yes |
| drinking | string | Yes |
| smoking | string | Yes |
| hasPets | string | Yes |
| petAttitude | string | Yes（无论 hasPets 取值如何都必填） |
| lifestyleTidiness | string | Yes |
| interests | string[] | Yes（至少 1 项） |

### Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| 21001 | 400 | 尚未完成「基础信息」步骤 |

---

## PUT /customer/profile/accommodation-travel

### Description

提交第 3 步：住宿偏好 + 旅行风格。全部字段必填。

### Request

| Field | Type | Required |
|---|---|---|
| homeTypes | string[] | Yes（至少 1 项） |
| spaceFeatures | string[] | Yes（至少 1 项） |
| livingNeeds | string[] | Yes（至少 1 项） |
| travelCompanions | string[] | Yes（至少 1 项） |
| travelStyles | string[] | Yes（至少 1 项） |
| cityExplorationStyles | string[] | Yes（至少 1 项） |
| travelFrequency | string | Yes |
| languages | string[] | Yes（至少 1 项） |

### Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| 21001 | 400 | 尚未完成「我的生活方式」步骤 |

---

## POST /customer/profile/complete

### Description

第 4 步：预览确认提交，标记资料已完成，解锁换房核心功能（供未来 Capability 通过 `ProfileCompletedGuard` 复用判断）。

### Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| 21001 | 400 | 尚未完成「住宿偏好与旅行风格」步骤 |

---

## PATCH /customer/account/wechat-identity

### Description

回填微信授权获取到的头像/昵称（也可用于用户后续自行修改）。两个字段都可选，只更新传入的字段。

### Request

| Field | Type | Required |
|---|---|---|
| nickname | string | No（最长 50 字符） |
| avatarUrl | string | No（需为合法 URL，最长 1000 字符） |

---

## 通用错误码

| Code | 名称 |
|---|---|
| 21001 | PROFILE_STEP_OUT_OF_ORDER |
| 21003 | PROFILE_NOT_COMPLETE（供未来需要"资料已完成"才能访问的接口使用） |
| 21004 | REALNAME_NOT_VERIFIED |
| 21005 | ID_CARD_NUMBER_INVALID |
