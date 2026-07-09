-- CreateEnum
CREATE TYPE "VoucherBatchStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "voucher_batches" (
    "id" UUID NOT NULL,
    "batch_number" SERIAL NOT NULL,
    "plan_id" UUID NOT NULL,
    "router_id" UUID,
    "quantity" INTEGER NOT NULL,
    "generated" INTEGER NOT NULL DEFAULT 0,
    "status" "VoucherBatchStatus" NOT NULL DEFAULT 'PENDING',
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "voucher_batches_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "vouchers" ADD COLUMN "batch_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "voucher_batches_batch_number_key" ON "voucher_batches"("batch_number");

-- CreateIndex
CREATE INDEX "voucher_batches_plan_id_idx" ON "voucher_batches"("plan_id");

-- CreateIndex
CREATE INDEX "voucher_batches_created_at_idx" ON "voucher_batches"("created_at");

-- CreateIndex
CREATE INDEX "voucher_batches_created_by_id_idx" ON "voucher_batches"("created_by_id");

-- CreateIndex
CREATE INDEX "vouchers_batch_id_idx" ON "vouchers"("batch_id");

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "voucher_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_batches" ADD CONSTRAINT "voucher_batches_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_batches" ADD CONSTRAINT "voucher_batches_router_id_fkey" FOREIGN KEY ("router_id") REFERENCES "routers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voucher_batches" ADD CONSTRAINT "voucher_batches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
