import { Module } from '@nestjs/common';
import { FixedTestCodeSmsSender } from './fixed-test-code.sender.js';
import { SMS_SENDER } from './sms-sender.interface.js';
import { smsSenderProvider } from './sms-sender.provider.js';
import { TencentCloudInternationalSmsSender } from './tencent-cloud-sms.sender.js';

@Module({
  providers: [FixedTestCodeSmsSender, TencentCloudInternationalSmsSender, smsSenderProvider],
  exports: [SMS_SENDER],
})
export class SmsModule {}
