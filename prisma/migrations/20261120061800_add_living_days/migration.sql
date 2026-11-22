-- CreateEnum
CREATE TYPE "BenefitPackageCode" AS ENUM ('FIRST_LIVING_EXCHANGE');

-- CreateEnum
CREATE TYPE "BenefitPackageStatus" AS ENUM ('AVAILABLE', 'USED');

-- CreateEnum
CREATE TYPE "SettlementSource" AS ENUM ('BENEFIT_PACKAGE', 'LIVING_DAYS');

-- CreateEnum
CREATE TYPE "LivingExchangeStatus" AS ENUM ('OPEN', 'REJECTED', 'CANCELLED', 'NOT_COMPLETED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "LivingDaysDirection" AS ENUM ('EARNED', 'SPENT');

-- CreateTable
CREATE TABLE "benefit_packages" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "code" "BenefitPackageCode" NOT NULL,
    "status" "BenefitPackageStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "benefit_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "living_days_accounts" (
    "account_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "living_days_accounts_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "living_exchanges" (
    "id" TEXT NOT NULL,
    "guest_account_id" TEXT NOT NULL,
    "host_account_id" TEXT NOT NULL,
    "selected_days" INTEGER NOT NULL,
    "settlement_source" "SettlementSource" NOT NULL,
    "benefit_package_id" TEXT,
    "status" "LivingExchangeStatus" NOT NULL DEFAULT 'OPEN',
    "actual_days" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "living_exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "living_days_ledger_entries" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "exchange_id" TEXT NOT NULL,
    "direction" "LivingDaysDirection" NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "living_days_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "benefit_packages_account_id_code_key" ON "benefit_packages"("account_id", "code");

-- CreateIndex
CREATE INDEX "living_exchanges_guest_account_id_status_idx" ON "living_exchanges"("guest_account_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "living_days_ledger_entries_exchange_id_account_id_direction_key" ON "living_days_ledger_entries"("exchange_id", "account_id", "direction");

-- AddForeignKey
ALTER TABLE "benefit_packages" ADD CONSTRAINT "benefit_packages_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "living_days_accounts" ADD CONSTRAINT "living_days_accounts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "living_exchanges" ADD CONSTRAINT "living_exchanges_guest_account_id_fkey" FOREIGN KEY ("guest_account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "living_exchanges" ADD CONSTRAINT "living_exchanges_host_account_id_fkey" FOREIGN KEY ("host_account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "living_exchanges" ADD CONSTRAINT "living_exchanges_benefit_package_id_fkey" FOREIGN KEY ("benefit_package_id") REFERENCES "benefit_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "living_days_ledger_entries" ADD CONSTRAINT "living_days_ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "living_days_ledger_entries" ADD CONSTRAINT "living_days_ledger_entries_exchange_id_fkey" FOREIGN KEY ("exchange_id") REFERENCES "living_exchanges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 一笔订单只能是权益包或 Living Days，不能各付一部分。
ALTER TABLE "living_exchanges" ADD CONSTRAINT "living_exchanges_source_package_ck" CHECK (
    (
        "settlement_source" = 'BENEFIT_PACKAGE'
        AND "benefit_package_id" IS NOT NULL
    )
    OR (
        "settlement_source" = 'LIVING_DAYS'
        AND "benefit_package_id" IS NULL
    )
);

ALTER TABLE "living_exchanges" ADD CONSTRAINT "living_exchanges_selected_days_positive" CHECK ("selected_days" >= 1);

ALTER TABLE "living_exchanges" ADD CONSTRAINT "living_exchanges_actual_days_range" CHECK (
    "actual_days" IS NULL
    OR ("actual_days" >= 0 AND "actual_days" <= "selected_days")
);

ALTER TABLE "living_days_accounts" ADD CONSTRAINT "living_days_accounts_balance_non_negative" CHECK ("balance" >= 0);

ALTER TABLE "living_days_ledger_entries" ADD CONSTRAINT "living_days_ledger_entries_amount_positive" CHECK ("amount" > 0);

-- 同一客人同时只能有一笔进行中的权益包订单。
CREATE UNIQUE INDEX "living_exchanges_one_open_benefit_per_guest" ON "living_exchanges" ("guest_account_id")
WHERE "settlement_source" = 'BENEFIT_PACKAGE' AND "status" = 'OPEN';

-- 已经同时满足发放条件的账号补发一张可用权益包。不创建天数账户。
INSERT INTO "benefit_packages" ("id", "account_id", "code", "status")
SELECT gen_random_uuid()::text, a."id", 'FIRST_LIVING_EXCHANGE', 'AVAILABLE'
FROM "accounts" a
INNER JOIN "customer_profiles" p ON p."account_id" = a."id"
INNER JOIN "account_real_name_verifications" r ON r."account_id" = a."id"
WHERE p."profile_completed_at" IS NOT NULL
  AND a."terms_agreed_at" IS NOT NULL
  AND a."phone_number" <> ''
ON CONFLICT ("account_id", "code") DO NOTHING;
