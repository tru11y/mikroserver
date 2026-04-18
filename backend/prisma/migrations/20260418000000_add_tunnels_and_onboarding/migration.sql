-- CreateEnum
CREATE TYPE "TunnelStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "tunnels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "tunnel_ip" VARCHAR(45) NOT NULL,
    "client_public_key" VARCHAR(64) NOT NULL,
    "server_public_key" VARCHAR(64) NOT NULL,
    "status" "TunnelStatus" NOT NULL DEFAULT 'PENDING',
    "last_handshake_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "tunnels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tunnels_tunnel_ip_key" ON "tunnels"("tunnel_ip");

-- CreateIndex
CREATE UNIQUE INDEX "tunnels_client_public_key_key" ON "tunnels"("client_public_key");

-- CreateIndex
CREATE INDEX "tunnels_owner_id_status_idx" ON "tunnels"("owner_id", "status");

-- AddForeignKey
ALTER TABLE "tunnels" ADD CONSTRAINT "tunnels_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: add zero-touch onboarding fields to routers
ALTER TABLE "routers" ADD COLUMN "tunnel_id" UUID;
ALTER TABLE "routers" ADD COLUMN "agent_username" VARCHAR(64) NOT NULL DEFAULT 'hsfl-agent';
ALTER TABLE "routers" ADD COLUMN "encrypted_agent_password" TEXT;
ALTER TABLE "routers" ADD COLUMN "credentials_iv" VARCHAR(32);
ALTER TABLE "routers" ADD COLUMN "credentials_auth_tag" VARCHAR(64);
ALTER TABLE "routers" ADD COLUMN "identity" VARCHAR(128);
ALTER TABLE "routers" ADD COLUMN "router_os_version" VARCHAR(32);
ALTER TABLE "routers" ADD COLUMN "board_name" VARCHAR(64);
ALTER TABLE "routers" ADD COLUMN "architecture" VARCHAR(32);
ALTER TABLE "routers" ADD COLUMN "hotspot_configured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "routers" ADD COLUMN "hotspot_interface" VARCHAR(64);
ALTER TABLE "routers" ADD COLUMN "hotspot_network" VARCHAR(32);

-- CreateIndex
CREATE UNIQUE INDEX "routers_tunnel_id_key" ON "routers"("tunnel_id");

-- CreateIndex
CREATE INDEX "routers_last_seen_at_idx" ON "routers"("last_seen_at");

-- AddForeignKey
ALTER TABLE "routers" ADD CONSTRAINT "routers_tunnel_id_fkey" FOREIGN KEY ("tunnel_id") REFERENCES "tunnels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
