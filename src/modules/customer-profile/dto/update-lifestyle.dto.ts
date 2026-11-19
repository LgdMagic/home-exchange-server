import { ArrayMinSize, ArrayUnique, IsArray, IsIn } from 'class-validator';
import {
  ATMOSPHERE_PREFERENCE_OPTIONS,
  DRINKING_OPTIONS,
  HAS_PETS_OPTIONS,
  INTEREST_OPTIONS,
  LIFESTYLE_TIDINESS_OPTIONS,
  PET_ATTITUDE_OPTIONS,
  SLEEP_SCHEDULE_OPTIONS,
  SMOKING_OPTIONS,
} from '../constants/profile-options.js';

export class UpdateLifestyleDto {
  @IsIn(SLEEP_SCHEDULE_OPTIONS)
  sleepSchedule!: string;

  @IsIn(ATMOSPHERE_PREFERENCE_OPTIONS)
  atmospherePreference!: string;

  @IsIn(DRINKING_OPTIONS)
  drinking!: string;

  @IsIn(SMOKING_OPTIONS)
  smoking!: string;

  @IsIn(HAS_PETS_OPTIONS)
  hasPets!: string;

  /** 无论 hasPets 选什么都必填，见 spec.md「宠物情况与对宠物的态度」 */
  @IsIn(PET_ATTITUDE_OPTIONS)
  petAttitude!: string;

  @IsIn(LIFESTYLE_TIDINESS_OPTIONS)
  lifestyleTidiness!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(INTEREST_OPTIONS, { each: true })
  interests!: string[];
}
