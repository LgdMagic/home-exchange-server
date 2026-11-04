import { Controller, Get } from '@nestjs/common';
import { AppService, type AppInfo } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getInfo(): AppInfo {
    return this.appService.getInfo();
  }
}
