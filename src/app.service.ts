import { Injectable } from '@nestjs/common';

export interface AppInfo {
  name: string;
  status: 'ok';
}

@Injectable()
export class AppService {
  getInfo(): AppInfo {
    return {
      name: 'home-exchange-server',
      status: 'ok',
    };
  }
}
