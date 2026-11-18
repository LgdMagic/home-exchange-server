# 测试环境部署手册（腾讯云 CVM + Docker）

适用场景：1 台腾讯云云服务器（CVM），没有单独的云数据库，用 Docker 在同一台机器上同时跑应用和 PostgreSQL。

## 0. 前提

- 已有一台腾讯云 CVM，能 SSH 登录（有公网 IP 或已绑定域名）
- 已完成 ICP 备案（如果要用域名访问；只用 IP+端口可以先跳过）
- 腾讯云短信（国际短信）相关密钥已申请好：`SecretId`、`SecretKey`、`SmsSdkAppId`、签名、模板 ID
- 微信小程序 `AppID`/`AppSecret`

## 1. 服务器上安装 Docker（如果还没装）

先看系统是什么（Ubuntu / TencentOS / CentOS）：

```bash
cat /etc/os-release
```

**Ubuntu / Debian：**

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
```

**TencentOS / CentOS：**

```bash
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker
```

验证：

```bash
docker --version
docker compose version
```

## 2. 拉代码

```bash
# 如果仓库是私有的，需要先在服务器上配置好 git 的访问权限（部署密钥/PAT），
# 做法和本地 git push 用的 SSH key 是一个逻辑，不在本手册展开。
git clone git@github.com:LgdMagic/home-exchange-server.git
cd home-exchange-server
```

以后更新代码只需要：

```bash
git pull
cd deploy && docker compose up -d --build
```

## 3. 配置环境变量

```bash
cp deploy/.env.example deploy/.env
vim deploy/.env   # 填入真实值
```

必须修改的几项（不要用 `.env.example` 里的示例值）：

- `POSTGRES_PASSWORD` / `DATABASE_URL` 中的密码：换成强随机密码
- `JWT_SECRET`：换成一个新的、足够长的随机字符串（不要和本地开发用的一样）
- `WECHAT_MINI_APP_ID` / `WECHAT_MINI_APP_SECRET`

短信这块**当前阶段不用管**：腾讯云短信资质还在单独推进，测试环境先维持 `AUTH_SMS_TEST_MODE=true`（固定验证码 999999），等审批/配置好了再切换成 `false` 并填真实凭证——不需要改代码，只改这个 `.env`。

确认这两项（已经是 `.env.example` 里的默认值，不用改，但启动前确认一下）：`NODE_ENV=production`、`APP_ENV=test`。

> ⚠️ 这个 `.env` 文件本身已被 `.gitignore` 排除，不会被提交；但依然要自己做好权限管控（服务器上的文件权限、不要通过不安全渠道传输）。

## 4. 启动

```bash
cd deploy
docker compose up -d --build
```

第一次启动后，数据库是空的，需要跑一次迁移：

```bash
docker compose exec app pnpm exec prisma migrate deploy
```

> `migrate deploy` 只会应用已经存在的 migration 文件（`prisma/migrations/`），不会像 `migrate dev` 那样生成新的 migration，这是生产/测试环境该用的命令。

## 5. 验证

```bash
curl http://127.0.0.1:3000/
curl http://127.0.0.1:3000/health
```

如果要从外部（你自己的电脑）访问，还需要：

1. **去腾讯云控制台把端口开放**：云服务器 → 安全组 → 添加规则，放行 TCP 3000（或者你打算用的端口/80/443）。这一步只能在腾讯云控制台操作，Docker 跑起来了但外部访问不了，十有八九是卡在这一步。
2. 用 `http://<服务器公网IP>:3000/health` 测试。

## 6.（可选）绑定域名 + HTTPS

当前应用直接监听 3000 端口。如果想用你已经备案好的域名正常访问（`https://test.yourdomain.com`），建议加一层 Nginx 反向代理 + Let's Encrypt 证书，而不是让 Node 应用自己处理 TLS。这部分需要你提供域名/子域名之后再补充具体配置，先跳过。

## 7. 常用命令

| 操作 | 命令 |
|---|---|
| 查看日志 | `docker compose logs -f app` |
| 重启应用 | `docker compose restart app` |
| 停止全部 | `docker compose down`（加 `-v` 会连数据库数据一起删，谨慎） |
| 进容器调试 | `docker compose exec app sh` |
| 跑迁移 | `docker compose exec app pnpm exec prisma migrate deploy` |
| 数据库备份 | `docker compose exec postgres pg_dump -U home_exchange home_exchange > backup.sql` |

## 8. 关于 NODE_ENV 和 APP_ENV 的说明

`.env.example` 里把 `NODE_ENV` 设为 `production`，不是写错了——持续部署运行的环境（不管叫测试环境还是正式环境）按惯例都用 `production`，这样框架层面的优化（比如日志格式）才会生效。

但"是否允许用固定验证码 999999"这类安全检查，看的是另一个变量 `APP_ENV`，不是 `NODE_ENV`——测试环境设 `APP_ENV=test`，就可以继续用固定验证码；等这台服务器以后真的要承接正式用户流量、变成正式生产环境时，把 `APP_ENV` 改成 `production`，应用会在启动时主动拒绝"固定验证码 + 正式生产环境"这种组合（见 `src/modules/sms/sms-sender.provider.ts`），逼着你必须先把真实短信接上才能切换，不会出现"忘了关测试开关导致生产环境裸奔"的情况。
