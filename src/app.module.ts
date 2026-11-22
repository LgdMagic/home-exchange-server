import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PiiEncryptionModule } from './common/crypto/pii-encryption.module.js';
import configuration from './config/configuration.js';
import { validateEnv } from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';
import { AccountModule } from './modules/account/account.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CustomerProfileModule } from './modules/customer-profile/customer-profile.module.js';
import { LivingDaysModule } from './modules/living-days/living-days.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('log.level'),
          transport:
            config.get<string>('app.nodeEnv') !== 'production'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          redact: ['req.headers.authorization', 'req.headers.cookie'],
        },
      }),
    }),
    PrismaModule,
    PiiEncryptionModule,
    HealthModule,
    AuthModule,
    AccountModule,
    CustomerProfileModule,
    LivingDaysModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
