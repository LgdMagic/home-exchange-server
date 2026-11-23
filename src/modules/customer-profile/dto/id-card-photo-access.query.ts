import { IsOptional, IsUUID } from 'class-validator';

export class IdCardPhotoAccessQueryDto {
  /** 不传则查看当前登录账号。管理后台可传任意账号，当前不校验是不是本人。 */
  @IsOptional()
  @IsUUID()
  accountId?: string;
}
