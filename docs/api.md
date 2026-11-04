# API Documentation

API 总目录。每个 API 必须标注 Consumer（Admin / Client / Both），详情见对应的 `api/*.md` 文档。

本文档是已实现/已交付 API 契约的 Source of Truth，具体约定见 [`.cursor/rules/backend.md`](../.cursor/rules/backend.md) 第 43-48 节。

## Infra

| Method | Path | Description | Consumer | Status | Detail |
|---|---|---|---|---|---|
| GET | /health | 健康检查（含数据库连通性） | Infra | DONE | - |

<!--
后续新增 API 时，按能力/模块分组追加表格，例如：

## F001 User Register

| Method | Path | Description | Consumer | Status | Detail |
|---|---|---|---|---|---|
| POST | /api/auth/register | 用户注册 | Client | IN_PROGRESS | api/F001-user-register.md |
-->
