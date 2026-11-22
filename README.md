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

## 技术栈

- 运行时：Node.js 22+（ESM / NodeNext）
- 框架：[NestJS](https://nestjs.com/)（Controller / Service / Repository 分层）
- 语言：TypeScript（strict）
- 数据库：PostgreSQL，ORM 为 [Prisma](https://www.prisma.io/)（v7，通过 `@prisma/adapter-pg` 驱动适配器连接）
- 校验：class-validator / class-transformer（全局 `ValidationPipe`）
- 认证基础库：`@nestjs/jwt` + `passport-jwt`（具体登录/鉴权业务逻辑待对应 OpenSpec Change 落地）
- 日志：`nestjs-pino`（结构化日志）
- 健康检查：`@nestjs/terminus`，暴露 `GET /health`（含数据库连通性检查）
- API 文档（开发期辅助）：`@nestjs/swagger`，暴露 `GET /docs`；**正式 API Contract 以 `docs/api.md` 及 `docs/api/` 为准**（见下文）
- 包管理：pnpm
- 测试：Vitest（单元测试 + e2e）
- Lint/格式化：oxlint + prettier

统一响应结构（Response Envelope）、业务错误码、全局异常过滤器已在 `src/common/` 下搭好基础设施，具体业务错误码由各 OpenSpec Change 实现时补充（见 `.cursor/rules/backend.md` 第 27-29 节）。

### 已实现的业务能力

- **`customer-phone-auth`**（OpenSpec Change: `add-customer-phone-login`）：C 端手机号登录/注册（微信一键获取手机号 + 手机号/验证码两种方式），详见 `docs/api/F001-customer-phone-login.md`。
  - 需要额外的环境变量：`WECHAT_MINI_APP_ID` / `WECHAT_MINI_APP_SECRET`（微信小程序，AppSecret 严禁提交到 git）、`AUTH_SMS_TEST_MODE`（测试期固定验证码 `999999` 的开关，生产环境必须为 `false`）、`TENCENT_SMS_*` 系列（腾讯云国际短信，审批通过后启用，当前真实调用代码整体注释，见 `src/modules/sms/tencent-cloud-sms.sender.ts`）。
  - 同时建立了项目首套登录态校验基础设施（`JwtAuthGuard` + `@CurrentAccountId()`），供后续所有需要登录的能力复用。
- **`customer-profile`**（OpenSpec Change: `add-customer-profile-setup`）：C 端个人资料编辑（基础信息/生活方式/住宿偏好/旅行风格三步 + 预览确认），详见 `docs/api/F002-customer-profile-setup.md`。
- **`customer-real-name-verification`**（OpenSpec Change: `add-customer-real-name-verification`）：提交姓名、大陆身份证号，以及身份证人像面和国徽面。状态为待核验，提交后锁定，同一身份证号只能绑定一个账号。照片加密存在本地，接口不返回照片。详见 `docs/api/F003-customer-real-name-verification.md`。
  - 需要额外的环境变量：`PII_ENCRYPTION_KEY`（敏感个人信息加密密钥，32 字节 base64，同时用于 AES-256-GCM 和身份证号 HMAC，每个环境必须不同，一旦使用不可更换）。证件照片目录可用 `ID_CARD_PHOTO_DIR`，不配置时是 `storage/id-card-photos`。
- **`living-days`**（OpenSpec Change: `add-living-days`）：Living Days 余额与首次交换权益包分开记账。一笔订单只能选用其中一样。会员只能查询，不能给自己加天数。详见 `docs/api/F004-living-days.md`。

## 本地开发

### 1. 安装依赖

```bash
pnpm install
```

### 2. 准备 PostgreSQL

二选一：

**方式 A：使用本机已安装的 PostgreSQL**（当前本地开发默认方式，例如通过 [Postgres.app](https://postgresapp.com/) 或 Homebrew 安装）

> 当前本机是通过 Postgres.app 自带的二进制（未走 GUI）以独立数据目录启动的：
>
> ```bash
> PGBIN=/Applications/Postgres.app/Contents/Versions/18/bin
> PGDATA=/Users/macliu/postgres-data
> "$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/logfile" start   # 启动
> "$PGBIN/pg_ctl" -D "$PGDATA" stop                          # 停止
> "$PGBIN/pg_isready" -h 127.0.0.1 -p 5432                   # 检查是否就绪
> ```
>
> 这个数据目录不在 Postgres.app GUI 的默认管理范围内，GUI 里不会显示/控制它；如果希望用 GUI 管理，需要改用 Postgres.app 默认的数据目录约定，或直接在 GUI 里新建一个 server。

确保存在以下数据库与账号：

```sql
CREATE DATABASE home_exchange;
CREATE USER home_exchange WITH PASSWORD 'home_exchange';
GRANT ALL PRIVILEGES ON DATABASE home_exchange TO home_exchange;
-- PostgreSQL 15+ 需要额外授予 schema 权限：
\c home_exchange
GRANT ALL ON SCHEMA public TO home_exchange;
```

**方式 B：使用 Docker Compose**（适合没有本机 PostgreSQL、或想要一个干净可复现环境的情况）

```bash
pnpm db:up    # docker compose up -d postgres
# 用完后
pnpm db:down  # docker compose down
```

两种方式的账号密码约定一致（见 `docker-compose.yml` 与 `.env.example`），只需保证 `.env` 中的 `DATABASE_URL` 指向你实际在用的那一个。

### 3. 配置环境变量

```bash
cp .env.example .env
# 按需修改 .env，本地默认值已经可以直接跑起来
```

### 4. 生成 Prisma Client / 执行迁移

```bash
pnpm prisma:generate       # 生成 Prisma Client 到 src/generated/prisma（已 gitignore，按需重新生成）
pnpm prisma:migrate:dev    # 本地开发：根据 schema 变化创建并应用 migration（PostgreSQL 不需要 shadow database 的额外授权）
```

### 5. 启动开发服务器

```bash
pnpm start:dev
```

验证：

```bash
curl http://localhost:3000/        # { "code": 0, "message": "success", "data": { "name": "home-exchange-server", "status": "ok" } }
curl http://localhost:3000/health  # Terminus 健康检查，包含数据库连通性
open  http://localhost:3000/docs   # Swagger UI（开发期接口浏览，非正式契约）
```

### 常用脚本

| 脚本                          | 说明                                             |
| ----------------------------- | ------------------------------------------------ |
| `pnpm start:dev`              | 开发模式启动（watch）                            |
| `pnpm build`                  | 编译到 `dist/`                                   |
| `pnpm test`                   | 单元测试（Vitest）                               |
| `pnpm test:e2e`               | e2e 测试（需要可用的 MySQL）                     |
| `pnpm lint`                   | oxlint 静态检查                                  |
| `pnpm format`                 | Prettier 格式化                                  |
| `pnpm prisma:generate`        | 生成 Prisma Client                               |
| `pnpm prisma:migrate:dev`     | 本地创建/应用 migration                          |
| `pnpm prisma:migrate:deploy`  | 生产/CI 应用已有 migration（不生成新 migration） |
| `pnpm prisma:studio`          | 打开 Prisma Studio 查看数据                      |
| `pnpm db:up` / `pnpm db:down` | 启停 docker-compose 本地 MySQL（可选方式）       |

## API 文档

API 总文档与详细文档维护在：

```
docs/api.md
docs/api/
```

它们是后端 API 已实现/已交付契约的 **Source of Truth**，`home-exchange-admin`、`home-exchange-uniapp` 应以其完成 API 对接；`/docs`（Swagger）仅供开发期调试探索，不能替代上述文档（见 `.cursor/rules/backend.md` 第 43 节）。
