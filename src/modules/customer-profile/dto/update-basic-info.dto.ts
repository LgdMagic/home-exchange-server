import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Gender } from '../../../generated/prisma/enums.js';

export class UpdateBasicInfoDto {
  @IsEnum(Gender)
  gender!: Gender;

  /** 国内城市名称/code，或固定值 "OTHER"；后端不做穷举校验，见 design.md Decisions 第 4 条 */
  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  occupation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}
