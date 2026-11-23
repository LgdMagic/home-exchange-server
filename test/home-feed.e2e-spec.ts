import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';

describe('home-feed (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor(new Reflector()));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('未登录也能拿到编排好的首页内容，且不含首次交换引导', async () => {
    const response = await request(app.getHttpServer()).get(
      '/customer/home-feed',
    );

    expect(response.status).toBe(200);
    expect(response.body.code).toBe(0);
    expect(response.body.data.today.place).toBe('大理 · 中国');
    expect(response.body.data.today.tags).toEqual(['远程办公友好', '慢生活']);
    expect(
      response.body.data.inspirations.map(
        (item: { title: string }) => item.title,
      ),
    ).toEqual(['在海边的早晨', '在别人的城市']);
    expect(response.body.data.story.memberName).toBe('Luna（深圳）');
    expect(response.body.data.weekend.place).toBe('京都 · 日本');
    expect(response.body.data.belong.title).toBe('大理女设计师的一天');
    expect(JSON.stringify(response.body)).not.toContain(
      'Start Your First Living Exchange',
    );
  });
});
