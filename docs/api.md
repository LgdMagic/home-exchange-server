# API Documentation

API 总目录。每个 API 必须标注 Consumer（Admin / Client / Both），详情见对应的 `api/*.md` 文档。

本文档是已实现/已交付 API 契约的 Source of Truth，具体约定见 [`.cursor/rules/backend.md`](../.cursor/rules/backend.md) 第 43-48 节。

## Infra

| Method | Path    | Description                | Consumer | Status | Detail |
| ------ | ------- | -------------------------- | -------- | ------ | ------ |
| GET    | /health | 健康检查（含数据库连通性） | Infra    | DONE   | -      |

## F001 Customer Phone Login

OpenSpec Change: `add-customer-phone-login`（`openspec/changes/add-customer-phone-login/`）

| Method | Path                              | Description                          | Consumer | Status | Detail                           |
| ------ | --------------------------------- | ------------------------------------ | -------- | ------ | -------------------------------- |
| POST   | /customer/auth/sms-code           | 发送手机号登录验证码                 | Client   | DONE   | api/F001-customer-phone-login.md |
| POST   | /customer/auth/login/sms          | 手机号 + 验证码登录（登录即注册）    | Client   | DONE   | api/F001-customer-phone-login.md |
| POST   | /customer/auth/login/wechat-phone | 微信一键获取手机号登录（登录即注册） | Client   | DONE   | api/F001-customer-phone-login.md |

> ⚠️ 测试期说明：`AUTH_SMS_TEST_MODE=true` 时，验证码固定为 `999999`，不发送真实短信（腾讯云国际短信资质审批通过前的临时状态，见 design.md Decisions 第 6 条）。

## F002 Customer Profile Setup

OpenSpec Change: `add-customer-profile-setup`（`openspec/changes/add-customer-profile-setup/`）

全部接口需要登录（`Authorization: Bearer <accessToken>`）。

| Method | Path                                   | Description                          | Consumer | Status | Detail                             |
| ------ | -------------------------------------- | ------------------------------------ | -------- | ------ | ---------------------------------- |
| GET    | /customer/profile                      | 获取当前个人资料（含进度、脱敏展示） | Client   | DONE   | api/F002-customer-profile-setup.md |
| PUT    | /customer/profile/basic-info           | 提交基础信息（第 1 步）              | Client   | DONE   | api/F002-customer-profile-setup.md |
| PUT    | /customer/profile/lifestyle            | 提交我的生活方式（第 2 步）          | Client   | DONE   | api/F002-customer-profile-setup.md |
| PUT    | /customer/profile/accommodation-travel | 提交住宿偏好+旅行风格（第 3 步）     | Client   | DONE   | api/F002-customer-profile-setup.md |
| POST   | /customer/profile/complete             | 预览确认，标记资料完成（第 4 步）    | Client   | DONE   | api/F002-customer-profile-setup.md |
| POST   | /customer/account/avatar               | 上传头像到对象存储                    | Client   | DONE   | api/F002-customer-profile-setup.md |
| PUT    | /customer/account/wechat-identity      | 回填微信头像/昵称（小程序使用）      | Client   | DONE   | api/F002-customer-profile-setup.md |
| PATCH  | /customer/account/wechat-identity      | 同上，与 PUT 等价                    | Client   | DONE   | api/F002-customer-profile-setup.md |

> 实名信息的提交和查询见 F003。资料接口只读取已提交的姓名（脱敏）和出生日期，`realNameStatus` 为 `PENDING` 时表示待核验。

## F003 Customer Real Name Verification

OpenSpec Change: `add-customer-real-name-verification`（`openspec/changes/add-customer-real-name-verification/`）

全部接口需要登录（`Authorization: Bearer <accessToken>`）。

| Method | Path                             | Description                            | Consumer | Status | Detail                                      |
| ------ | -------------------------------- | -------------------------------------- | -------- | ------ | ------------------------------------------- |
| GET    | /customer/real-name-verification             | 查询是否已提交，以及正反面是否已上传           | Client   | DONE   | api/F003-customer-real-name-verification.md |
| GET    | /customer/real-name-verification/id-card-photo/access | 获取身份证照片的 10 分钟签名地址     | Client   | DONE   | api/F003-customer-real-name-verification.md |
| POST   | /customer/real-name-verification/id-card-photo | 上传身份证人像面或国徽面                       | Client   | DONE   | api/F003-customer-real-name-verification.md |
| POST   | /customer/real-name-verification             | 提交姓名、身份证号和已上传的正反面，记为待核验 | Client   | DONE   | api/F003-customer-real-name-verification.md |

## F004 Living Days

OpenSpec Change: `add-living-days`（`openspec/changes/add-living-days/`）

查询接口需要登录（`Authorization: Bearer <accessToken>`）。没有购买、充值或转让接口。结算不暴露给会员。

| Method | Path                  | Description                           | Consumer | Status | Detail                  |
| ------ | --------------------- | ------------------------------------- | -------- | ------ | ----------------------- |
| GET    | /customer/living-days | 查询 Living Days 余额和首次交换权益包 | Client   | DONE   | api/F004-living-days.md |

## F005 Home Feed

OpenSpec Change: `add-home-feed`（`openspec/changes/add-home-feed/`）

不需要登录。运营配置完成前只返回编排好的展示内容。

| Method | Path                | Description                             | Consumer | Status | Detail                |
| ------ | ------------------- | --------------------------------------- | -------- | ------ | --------------------- |
| GET    | /customer/home-feed | 首页今日推荐、灵感、故事、周末、Belong | Client   | DONE   | api/F005-home-feed.md |

<!--
后续新增 API 时，按能力/模块分组追加表格，例如：

## F002 Xxx

| Method | Path | Description | Consumer | Status | Detail |
|---|---|---|---|---|---|
| POST | /api/xxx | Xxx | Client | IN_PROGRESS | api/F002-xxx.md |
-->
