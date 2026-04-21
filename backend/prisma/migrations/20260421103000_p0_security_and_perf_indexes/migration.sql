-- P0: performance indexes identified during security/stability audit

CREATE INDEX IF NOT EXISTS "sessions_mikrotik_id_idx"
  ON "sessions"("mikrotik_id");

CREATE INDEX IF NOT EXISTS "subscriptions_user_id_status_idx"
  ON "subscriptions"("user_id", "status");

CREATE INDEX IF NOT EXISTS "speed_boosts_router_id_idx"
  ON "speed_boosts"("router_id");

CREATE INDEX IF NOT EXISTS "commission_payouts_reseller_id_status_idx"
  ON "commission_payouts"("reseller_id", "status");

CREATE INDEX IF NOT EXISTS "router_port_maps_public_ports_idx"
  ON "router_port_maps"("public_webfig_port", "public_winbox_port", "public_ssh_port");
