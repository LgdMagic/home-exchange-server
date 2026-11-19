-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ProfileSetupStep" AS ENUM ('BASIC_INFO', 'LIFESTYLE', 'ACCOMMODATION_TRAVEL', 'COMPLETED');

-- CreateTable
CREATE TABLE "account_real_name_verifications" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "real_name" TEXT NOT NULL,
    "id_card_number_encrypted" TEXT NOT NULL,
    "birth_date" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_real_name_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "gender" "Gender",
    "city" TEXT,
    "occupation" TEXT,
    "bio" VARCHAR(500),
    "sleep_schedule" TEXT,
    "atmosphere_preference" TEXT,
    "drinking" TEXT,
    "smoking" TEXT,
    "has_pets" TEXT,
    "pet_attitude" TEXT,
    "lifestyle_tidiness" TEXT,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "home_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "space_features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "living_needs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "travel_companions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "travel_styles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "city_exploration_styles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "travel_frequency" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "current_step" "ProfileSetupStep" NOT NULL DEFAULT 'BASIC_INFO',
    "basic_info_completed_at" TIMESTAMP(3),
    "lifestyle_completed_at" TIMESTAMP(3),
    "accommodation_travel_completed_at" TIMESTAMP(3),
    "profile_completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_real_name_verifications_account_id_key" ON "account_real_name_verifications"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_account_id_key" ON "customer_profiles"("account_id");

-- AddForeignKey
ALTER TABLE "account_real_name_verifications" ADD CONSTRAINT "account_real_name_verifications_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
