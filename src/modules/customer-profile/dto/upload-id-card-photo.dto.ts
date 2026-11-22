import { IsIn } from 'class-validator';

export class UploadIdCardPhotoDto {
  @IsIn(['FRONT', 'BACK'], { message: '请选择人像面或国徽面' })
  side!: 'FRONT' | 'BACK';
}
