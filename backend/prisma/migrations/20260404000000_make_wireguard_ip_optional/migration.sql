-- AlterTable: make wireguard_ip nullable to allow router creation without tunnel
ALTER TABLE "routers" ALTER COLUMN "wireguard_ip" DROP NOT NULL;
