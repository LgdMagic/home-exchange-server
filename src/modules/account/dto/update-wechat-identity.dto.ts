import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/**
 * 回填微信授权获取到的头像/昵称（design.md「add-customer-profile-setup」Decisions 第 7 条）。
 * 两个字段都可选，但至少应提供一个，由 Service 层决定如何处理（当前不强制要求两者都传，
 * 支持只更新其中一个）。
 */
export class UpdateWechatIdentityDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  @MaxLength(1000)
  avatarUrl?: string;
}
