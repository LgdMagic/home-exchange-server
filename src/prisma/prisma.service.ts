import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * 全局 Prisma 客户端封装。
 *
 * 按 backend.md 第 39 节约定，Repository / Service 层应通过注入 PrismaService
 * 访问数据库，而不是各自创建 PrismaClient 实例。
 *
 * Prisma 7 要求通过 Driver Adapter 连接数据库（不再从 schema 的
 * datasource url 隐式连接），MySQL/MariaDB 对应 `@prisma/adapter-mariadb`。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    super({
      adapter: new PrismaMariaDb(configService.getOrThrow<string>('database.url')),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected to MySQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
