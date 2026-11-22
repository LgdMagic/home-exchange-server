-- 占位阶段写入的实名记录没有确定性哈希，且未经核验。
-- 新增非空唯一列之前清空，避免无法回填。
DELETE FROM "account_real_name_verifications";

-- CreateEnum
CREATE TYPE "RealNameVerificationStatus" AS ENUM ('PENDING');

-- AlterTable
ALTER TABLE "account_real_name_verifications" ADD COLUMN "id_card_number_hash" TEXT NOT NULL,
ADD COLUMN "status" "RealNameVerificationStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE UNIQUE INDEX "account_real_name_verifications_id_card_number_hash_key" ON "account_real_name_verifications"("id_card_number_hash");
