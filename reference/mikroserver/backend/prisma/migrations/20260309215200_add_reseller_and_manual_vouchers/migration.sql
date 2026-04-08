-- CreateEnum
CREATE TYPE "GenerationType" AS ENUM ('AUTO', 'MANUAL');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'RESELLER';

-- DropForeignKey
ALTER TABLE "vouchers" DROP CONSTRAINT "vouchers_transaction_id_fkey";

-- AlterTable
ALTER TABLE "vouchers" ADD COLUMN     "created_by_id" UUID,
ADD COLUMN     "generation_type" "GenerationType" NOT NULL DEFAULT 'AUTO',
ALTER COLUMN "transaction_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
