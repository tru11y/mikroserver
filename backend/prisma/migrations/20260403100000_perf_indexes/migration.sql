-- Performance indexes: added for common query patterns
-- Session: order-by createdAt on active-session listings
CREATE INDEX IF NOT EXISTS session_created_at_idx ON "sessions"("created_at");

-- Voucher: planId lookups (e.g. vouchers per plan) and composite status+routerId filter
CREATE INDEX IF NOT EXISTS voucher_plan_id_idx ON "vouchers"("plan_id");
CREATE INDEX IF NOT EXISTS voucher_status_router_id_idx ON "vouchers"("status", "router_id");

-- CustomerProfile: blocked-customer filter
CREATE INDEX IF NOT EXISTS customer_profile_is_blocked_idx ON "customer_profiles"("is_blocked");
