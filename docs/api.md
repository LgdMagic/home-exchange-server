# API Documentation

API 总目录。每个 API 必须标注 Consumer（Admin / Client / Both），详情见对应的 `api/*.md` 文档。

本文档是已实现/已交付 API 契约的 Source of Truth，具体约定见 [`.cursor/rules/backend.md`](../.cursor/rules/backend.md) 第 43-48 节。

## Infra

| Method | Path | Description | Consumer | Status | Detail |
|---|---|---|---|---|---|
| GET | /health | 健康检查（含数据库连通性） | Infra | DONE | - |

## F001 Customer Phone Login

OpenSpec Change: `add-customer-phone-login`（`openspec/changes/add-customer-phone-login/`）

| Method | Path | Description | Consumer | Status | Detail |
|---|---|---|---|---|---|
| POST | /customer/auth/sms-code | 发送手机号登录验证码 | Client | DONE | api/F001-customer-phone-login.md |
| POST | /customer/auth/login/sms | 手机号 + 验证码登录（登录即注册） | Client | DONE | api/F001-customer-phone-login.md |
| POST | /customer/auth/login/wechat-phone | 微信一键获取手机号登录（登录即注册） | Client | DONE | api/F001-customer-phone-login.md |

> ⚠️ 测试期说明：`AUTH_SMS_TEST_MODE=true` 时，验证码固定为 `999999`，不发送真实短信（腾讯云国际短信资质审批通过前的临时状态，见 design.md Decisions 第 6 条）。

## F002 Customer Profile Setup

OpenSpec Change: `add-customer-profile-setup`（`openspec/changes/add-customer-profile-setup/`）

全部接口需要登录（`Authorization: Bearer <accessToken>`）。

| Method | Path | Description | Consumer | Status | Detail |
|---|---|---|---|---|---|
| GET | /customer/profile | 获取当前个人资料（含进度、脱敏展示） | Client | DONE | api/F002-customer-profile-setup.md |
| POST | /customer/profile/real-name-placeholder | 自报姓名+身份证号（实名认证过渡占位） | Client | DONE | api/F002-customer-profile-setup.md |
| PUT | /customer/profile/basic-info | 提交基础信息（第 1 步） | Client | DONE | api/F002-customer-profile-setup.md |
| PUT | /customer/profile/lifestyle | 提交我的生活方式（第 2 步） | Client | DONE | api/F002-customer-profile-setup.md |
| PUT | /customer/profile/accommodation-travel | 提交住宿偏好+旅行风格（第 3 步） | Client | DONE | api/F002-customer-profile-setup.md |
| POST | /customer/profile/complete | 预览确认，标记资料完成（第 4 步） | Client | DONE | api/F002-customer-profile-setup.md |
| PATCH | /customer/account/wechat-identity | 回填微信头像/昵称 | Client | DONE | api/F002-customer-profile-setup.md |

> ⚠️ 实名认证说明：当前阶段"实名"为用户自报（姓名+身份证号格式校验），未经公安/OCR 真实核验，见 design.md Decisions 第 1 条。身份证号加密存储，不落明文，也不会出现在任何响应里。

<!--
后续新增 API 时，按能力/模块分组追加表格，例如：

## F002 Xxx

| Method | Path | Description | Consumer | Status | Detail |
|---|---|---|---|---|---|
| POST | /api/xxx | Xxx | Client | IN_PROGRESS | api/F002-xxx.md |
-->
