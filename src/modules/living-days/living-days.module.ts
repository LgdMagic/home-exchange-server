import { Module } from '@nestjs/common';
import { LivingDaysController } from './living-days.controller.js';
import { LivingDaysService } from './living-days.service.js';

@Module({
  controllers: [LivingDaysController],
  providers: [LivingDaysService],
  exports: [LivingDaysService],
})
export class LivingDaysModule {}
