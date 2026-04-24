-- AlterTable: add remote access fields to routers
ALTER TABLE "routers" ADD COLUMN "winbox_port" INTEGER NOT NULL DEFAULT 8291;
ALTER TABLE "routers" ADD COLUMN "webfig_port" INTEGER NOT NULL DEFAULT 80;
ALTER TABLE "routers" ADD COLUMN "ssh_port" INTEGER NOT NULL DEFAULT 22;
ALTER TABLE "routers" ADD COLUMN "access_username" VARCHAR(100) NOT NULL DEFAULT 'admin';
ALTER TABLE "routers" ADD COLUMN "access_password" VARCHAR(512);
