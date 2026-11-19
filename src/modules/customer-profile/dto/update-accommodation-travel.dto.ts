import { ArrayMinSize, ArrayUnique, IsArray, IsIn } from 'class-validator';
import {
  CITY_EXPLORATION_STYLE_OPTIONS,
  HOME_TYPE_OPTIONS,
  LANGUAGE_OPTIONS,
  LIVING_NEED_OPTIONS,
  SPACE_FEATURE_OPTIONS,
  TRAVEL_COMPANION_OPTIONS,
  TRAVEL_FREQUENCY_OPTIONS,
  TRAVEL_STYLE_OPTIONS,
} from '../constants/profile-options.js';

export class UpdateAccommodationTravelDto {
  // --- 住宿偏好 ---
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(HOME_TYPE_OPTIONS, { each: true })
  homeTypes!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(SPACE_FEATURE_OPTIONS, { each: true })
  spaceFeatures!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(LIVING_NEED_OPTIONS, { each: true })
  livingNeeds!: string[];

  // --- 旅行风格 ---
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(TRAVEL_COMPANION_OPTIONS, { each: true })
  travelCompanions!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(TRAVEL_STYLE_OPTIONS, { each: true })
  travelStyles!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(CITY_EXPLORATION_STYLE_OPTIONS, { each: true })
  cityExplorationStyles!: string[];

  @IsIn(TRAVEL_FREQUENCY_OPTIONS)
  travelFrequency!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsIn(LANGUAGE_OPTIONS, { each: true })
  languages!: string[];
}
