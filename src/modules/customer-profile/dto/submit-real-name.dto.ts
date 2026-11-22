import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class SubmitRealNameDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: '请填写姓名' })
  @Length(1, 30)
  realName!: string;

  /** 18 位大陆身份证号。校验码和出生日期在 Service 层校验，这里只约束长度。 */
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(18, 18)
  idCardNumber!: string;
}
