import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * 全局 Prisma 客户端封装。
 *
 * 按 backend.md 第 39 节约定，Repository / Service 层应通过注入 PrismaService
 * 访问数据库，而不是各自创建 PrismaClient 实例。
 *
 * Prisma 7 要求通过 Driver Adapter 连接数据库（不再从 schema 的
 * datasource url 隐式连接），PostgreSQL 对应 `@prisma/adapter-pg`。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: configService.getOrThrow<string>('database.url'),
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
