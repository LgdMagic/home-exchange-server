-- CreateEnum
CREATE TYPE "IdCardPhotoSide" AS ENUM ('FRONT', 'BACK');

-- CreateTable
CREATE TABLE "real_name_id_card_photos" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "side" "IdCardPhotoSide" NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "real_name_id_card_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "real_name_id_card_photos_account_id_side_key" ON "real_name_id_card_photos"("account_id", "side");

-- AddForeignKey
ALTER TABLE "real_name_id_card_photos" ADD CONSTRAINT "real_name_id_card_photos_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
