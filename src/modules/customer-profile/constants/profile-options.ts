/**
 * customer-profile 各单选/多选字段的合法取值清单（对应 proposal.md「What Changes」里列出的标签数据源）。
 *
 * 用英文代码而不是直接存中文文案，是刻意的技术决策：中文标签文案以后可能会被产品侧微调，
 * 用代码值可以在不触发数据库迁移的情况下调整展示文案（前端维护 代码 → 文案 的映射）。
 * 具体代码 ↔ 中文标签的对照见 docs/api/F002-customer-profile-setup.md。
 *
 * 清单本身是产品方在 proposal.md 里硬编码的固定集合，不是用户/运营可动态管理的标签系统；
 * 如需新增/调整选项，应作为对 proposal.md/spec.md 的变更提出，而不是在代码里随意改。
 */

export const SLEEP_SCHEDULE_OPTIONS = ['EARLY_BIRD', 'REGULAR', 'NIGHT_OWL'] as const;
export const ATMOSPHERE_PREFERENCE_OPTIONS = ['QUIET', 'CASUAL', 'LIVELY'] as const;
export const DRINKING_OPTIONS = ['NONE', 'OCCASIONAL', 'FREQUENT'] as const;
export const SMOKING_OPTIONS = ['NONE', 'OCCASIONAL', 'FREQUENT'] as const;
export const HAS_PETS_OPTIONS = ['HAS_PETS', 'NO_PETS'] as const;
export const PET_ATTITUDE_OPTIONS = ['LIKE', 'ACCEPTABLE', 'DISLIKE'] as const;
export const LIFESTYLE_TIDINESS_OPTIONS = ['TIDY', 'CLEAN_ENOUGH', 'CASUAL'] as const;

export const INTEREST_OPTIONS = [
  'PHOTOGRAPHY',
  'HIKING',
  'COFFEE',
  'READING',
  'MUSIC',
  'ART',
  'TRAVEL',
  'COOKING',
  'MOVIES',
  'CYCLING',
  'CAMPING',
  'CITY_WALK',
] as const;

export const HOME_TYPE_OPTIONS = [
  'URBAN_RESIDENCE', // 城市住宅
  'APARTMENT', // 公寓
  'GARDEN_HOUSE', // 花园洋房
  'LOFT_DUPLEX', // 复式/LOFT
  'DETACHED_HOUSE', // 独栋别墅
  'TOWNHOUSE', // 联排别墅
  'COURTYARD', // 院落/四合院
  'HERITAGE_HOUSE', // 老洋房/老宅
  'UNIQUE_STAY', // 特色住宅
] as const;

export const SPACE_FEATURE_OPTIONS = [
  'YARD', // 有院子
  'PLANTS_FLOWERS', // 有鲜花/植物
  'BALCONY', // 有阳台
  'TERRACE', // 有露台
  'QUIET', // 安静
  'GOOD_LIGHT', // 采光好
  'GOOD_VENTILATION', // 通风好
  'NATURE_VIEW', // 有自然景观
  'KITCHEN', // 有厨房
  'OUTDOOR_SPACE', // 有户外空间
] as const;

export const LIVING_NEED_OPTIONS = [
  'SMOKE_FREE', // 无烟
  'SOFT_BED', // 喜欢软床
  'KITCHEN', // 有厨房
  'WIFI', // 有 Wi-Fi
  'WASHING_MACHINE', // 有洗衣机
  'LONG_TERM_FRIENDLY', // 适合长住
  'PET_FRIENDLY', // 宠物友好
] as const;

export const TRAVEL_COMPANION_OPTIONS = [
  'SOLO', // 独自旅行
  'WITH_FRIENDS', // 和朋友一起
  'WITH_PARTNER', // 和伴侣一起
  'WITH_FAMILY', // 和家人一起
] as const;

export const TRAVEL_STYLE_OPTIONS = [
  'SLOW_TRAVEL', // 慢旅行
  'CITY_WALK', // 城市漫游
  'FOOD_EXPLORATION', // 美食探索
  'NATURE_EXPLORATION', // 自然探索
  'CULTURAL_EXPERIENCE', // 文化体验
  'PHOTOGRAPHY', // 摄影
  'OUTDOOR', // 户外
  'WEEKEND_TRIP', // 周末短途
] as const;

export const CITY_EXPLORATION_STYLE_OPTIONS = [
  'LIVE_LIKE_LOCAL', // 像当地人一样生活
  'LOCAL_SHOPS', // 逛当地的小店
  'FAVORITE_CAFE', // 找一家喜欢的咖啡馆
  'MEET_LOCALS', // 认识当地的人
  'EXPLORE_ON_FOOT', // 徒步探索城市
  'EXHIBITIONS_SHOWS', // 看展览/看演出
] as const;

export const TRAVEL_FREQUENCY_OPTIONS = [
  'RARELY', // 偶尔
  'TWO_TO_THREE_PER_YEAR', // 每年 2-3 次
  'FOUR_TO_SIX_PER_YEAR', // 每年 4-6 次
  'FREQUENT', // 经常旅行
] as const;

export const LANGUAGE_OPTIONS = ['ZH', 'EN', 'JA', 'KO', 'OTHER'] as const;

/** 所在城市选择"其他"时使用的 sentinel 值（见 design.md Decisions 第 4 条） */
export const CITY_OTHER_SENTINEL = 'OTHER';
