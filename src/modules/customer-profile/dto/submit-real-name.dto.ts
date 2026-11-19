import { IsNotEmpty, IsString, Length } from 'class-validator';

export class SubmitRealNameDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 30)
  realName!: string;

  /** 18 位身份证号；格式与校验码在 Service 层校验（见 id-card.util.ts），DTO 只做基础形状校验 */
  @IsString()
  @Length(18, 18)
  idCardNumber!: string;
}
