# syntax=docker/dockerfile:1

ARG NODE_VERSION=22

# ---- build：装全部依赖（含 devDependencies，prisma CLI/nest CLI 需要）并编译 ----
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
# pnpm install 会触发 postinstall（prisma generate），需要先有 prisma/schema.prisma
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# ---- runtime：复用 build 阶段的 node_modules，不重新安装 ----
# 测试环境优先简单可靠：保留 devDependencies（含 prisma CLI），
# 这样容器里可以直接执行 `pnpm exec prisma migrate deploy` 做迁移，
# 不需要额外的多阶段依赖裁剪。后续如需精简镜像体积，可再拆分 prod-only 依赖阶段。
FROM node:${NODE_VERSION}-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

EXPOSE 3000

CMD ["node", "dist/main.js"]
