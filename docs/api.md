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

<!--
后续新增 API 时，按能力/模块分组追加表格，例如：

## F002 Xxx

| Method | Path | Description | Consumer | Status | Detail |
|---|---|---|---|---|---|
| POST | /api/xxx | Xxx | Client | IN_PROGRESS | api/F002-xxx.md |
-->
