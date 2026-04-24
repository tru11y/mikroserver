-- CreateTable: router_port_maps
CREATE TABLE "router_port_maps" (
    "id"                  TEXT NOT NULL,
    "router_id"           UUID NOT NULL,
    "public_webfig_port"  INTEGER NOT NULL,
    "public_winbox_port"  INTEGER NOT NULL,
    "public_ssh_port"     INTEGER NOT NULL,
    "vpn_ip"              VARCHAR(45) NOT NULL,
    "rules_active"        BOOLEAN NOT NULL DEFAULT false,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "router_port_maps_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "router_port_maps_router_id_key"          ON "router_port_maps"("router_id");
CREATE UNIQUE INDEX "router_port_maps_public_webfig_port_key" ON "router_port_maps"("public_webfig_port");
CREATE UNIQUE INDEX "router_port_maps_public_winbox_port_key" ON "router_port_maps"("public_winbox_port");
CREATE UNIQUE INDEX "router_port_maps_public_ssh_port_key"    ON "router_port_maps"("public_ssh_port");

-- FK
ALTER TABLE "router_port_maps"
    ADD CONSTRAINT "router_port_maps_router_id_fkey"
    FOREIGN KEY ("router_id") REFERENCES "routers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
