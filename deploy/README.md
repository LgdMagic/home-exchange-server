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
- `PII_ENCRYPTION_KEY`：换成一个新的 32 字节 base64 密钥（生成方式见 `.env.example` 注释），不要和本地开发用的一样；**一旦投入使用后不要随意更换**（已加密的身份证号等数据会变得无法解密）
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

## 6. 绑定域名 + HTTPS

当前应用直接监听 3000 端口。用 Nginx 反向代理 + Let's Encrypt 证书来对外提供 HTTPS，Node 应用自己不处理 TLS。

以测试子域名 `apitest.wandercat.cn`、服务器公网 IP `139.199.199.61` 为例（已确认 `curl http://139.199.199.61:3000/health` 可通）。

### 6.1 确认域名解析

去你的 DNS 服务商（腾讯云 DNSPod 等）给 `apitest.wandercat.cn` 加一条 **A 记录**，指向 `139.199.199.61`，然后验证：

```bash
dig +short apitest.wandercat.cn
# 应该输出 139.199.199.61
```

没生效就等解析传播（通常几分钟），生效之前后面的 `certbot` 签发会失败。

### 6.2 安全组放行 80/443

腾讯云控制台 → 云服务器 → 安全组 → 添加规则，放行 TCP **80**（HTTP，证书签发用）和 **443**（HTTPS）。这一步漏了的话 certbot 验证域名所有权会失败。

### 6.3 在宿主机安装 Nginx（不是放进 Docker）

Nginx 和 certbot 装在宿主机上，直接反代到本机的 `3000` 端口（docker-compose 已经把容器的 3000 映射到宿主机）。

**Ubuntu/Debian：**

```bash
sudo apt update
sudo apt install -y nginx
```

**TencentOS/CentOS：**

```bash
sudo yum install -y nginx
sudo systemctl enable --now nginx
```

### 6.4 配置反向代理（先只开 80，给 certbot 用）

创建配置文件 `/etc/nginx/conf.d/apitest.wandercat.cn.conf`：

```nginx
server {
    listen 80;
    server_name apitest.wandercat.cn;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

检查语法并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

此时应该已经能用 `http://apitest.wandercat.cn/health` 访问到（走的是 80 端口反代，还没有 HTTPS）。

### 6.5 用 certbot 申请 Let's Encrypt 证书

**Ubuntu/Debian：**

```bash
sudo apt install -y certbot python3-certbot-nginx
```

**TencentOS/CentOS：**

```bash
sudo yum install -y certbot python3-certbot-nginx
```

签发证书并自动改写上面的 Nginx 配置（加 443 server block + 把 80 的流量重定向到 443）：

```bash
sudo certbot --nginx -d apitest.wandercat.cn
```

过程中会让你输入一个邮箱（用于证书到期提醒）、同意条款；如果问 "Redirect HTTP to HTTPS" 选 **2（Redirect）**。

### 6.6 验证

```bash
curl https://apitest.wandercat.cn/health
curl -I http://apitest.wandercat.cn/health   # 应该是 301/302 跳到 https
```

### 6.7 证书自动续期

certbot 安装时通常会自带一个 systemd timer（或 cron）定期续期，确认一下：

```bash
systemctl list-timers | grep certbot
sudo certbot renew --dry-run   # 模拟一次续期，确认流程没问题
```

Let's Encrypt 证书有效期 90 天，`certbot renew` 只会在快到期（默认剩 30 天内）时才真正续，所以这个 timer 平时跑着就行，不用手动管。

> 之后如果要从外部访问，优先用 `https://apitest.wandercat.cn/...`；直接访问 `http://139.199.199.61:3000` 仍然可用（3000 端口还开着），但不走 TLS，正式联调/前端对接建议统一用域名+HTTPS。

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
