# home-exchange-server

Home Exchange 项目的后端服务（Backend Server）。

## 项目定位

本仓库负责 Home Exchange 项目的服务端能力，包括：

- MySQL 数据库设计与迁移
- 后端业务逻辑（Service / Repository）
- API 设计、实现与 API 文档维护
- 认证与权限、数据校验、错误处理
- 后端测试

本仓库是以下两个前端的 API 提供方：

- [`home-exchange-admin`](../home-exchange-admin)：后台管理前端（运营/管理人员使用）
- [`home-exchange-uniapp`](../home-exchange-uniapp)：客户端（终端用户使用）

## 关联目录

本项目采用多仓库并列的 workspace 结构，以下目录与本仓库同级：

```
home-exchange/
├── home-exchange-server/      ← 本仓库，后端服务
├── home-exchange-admin/       ← 后台管理前端
├── home-exchange-uniapp/      ← 客户端
├── openspec/                  ← 全项目共用的 OpenSpec 变更与规格目录
└── product/                   ← 产品文档与设计资料
```

## 需求与开发流程

本项目所有新功能、业务规则变更、API 行为变更均通过 [OpenSpec](../openspec) Change 管理：

```
openspec/changes/{change-id}/
├── proposal.md   # what & why
├── specs/        # 本次变更的 spec delta
├── design.md     # how（技术设计）
└── tasks.md      # 实施任务清单
```

Backend Agent 的详细职责与规则见 [`.cursor/rules/backend.md`](.cursor/rules/backend.md)。

## API 文档

API 总文档与详细文档维护在：

```
docs/api.md
docs/api/
```

它们是后端 API 已实现/已交付契约的 Source of Truth，前端仓库应以其完成 API 对接。

## 技术栈

> TODO：补充具体技术栈（运行时、框架、ORM、部署方式等）。

## 本地开发

> TODO：补充环境变量配置、启动命令、测试命令等。
