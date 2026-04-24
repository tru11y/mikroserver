package com.mikroserver.infrastructure.persistence

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestamp

// ── Operators ────────────────────────────────────────────────────────────────

object OperatorsTable : Table("operators") {
    val id = uuid("id").autoGenerate()
    val name = text("name")
    val slug = text("slug").uniqueIndex()
    val tier = text("tier").default("FREE")
    val isActive = bool("is_active").default(true)
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    val deletedAt = timestamp("deleted_at").nullable()
    override val primaryKey = PrimaryKey(id)
}

// ── Users ────────────────────────────────────────────────────────────────────

object UsersTable : Table("users") {
    val id = uuid("id").autoGenerate()
    val operatorId = uuid("operator_id").references(OperatorsTable.id)
    val email = text("email")
    val passwordHash = text("password_hash")
    val role = text("role").default("VIEWER")
    val isActive = bool("is_active").default(true)
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    val deletedAt = timestamp("deleted_at").nullable()
    override val primaryKey = PrimaryKey(id)
}

// ── Refresh Tokens ───────────────────────────────────────────────────────────

object RefreshTokensTable : Table("refresh_tokens") {
    val id = uuid("id").autoGenerate()
    val userId = uuid("user_id").references(UsersTable.id)
    val tokenHash = text("token_hash").uniqueIndex()
    val familyId = uuid("family_id")
    val rotatedAt = timestamp("rotated_at").nullable()
    val revokedAt = timestamp("revoked_at").nullable()
    val expiresAt = timestamp("expires_at")
    val createdAt = timestamp("created_at")
    override val primaryKey = PrimaryKey(id)
}

// ── Routers ──────────────────────────────────────────────────────────────────

object RoutersTable : Table("routers") {
    val id = uuid("id").autoGenerate()
    val operatorId = uuid("operator_id").references(OperatorsTable.id)
    val name = text("name")
    val macAddress = text("mac_address").nullable()
    val wgPublicKey = text("wg_public_key")
    val wgPrivateKeyEnc = text("wg_private_key_enc").nullable()
    val wgAllowedIp = text("wg_allowed_ip").uniqueIndex()
    val wgEndpoint = text("wg_endpoint").nullable()
    val apiPort = integer("api_port").default(8728)
    val apiUsername = text("api_username").default("admin")
    val apiPasswordEnc = text("api_password_enc").nullable()
    val status = text("status").default("OFFLINE")
    val lastHandshakeAt = timestamp("last_handshake_at").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    val deletedAt = timestamp("deleted_at").nullable()
    override val primaryKey = PrimaryKey(id)
}

// ── Plans ────────────────────────────────────────────────────────────────────

object PlansTable : Table("plans") {
    val id = uuid("id").autoGenerate()
    val operatorId = uuid("operator_id").references(OperatorsTable.id)
    val name = text("name")
    val priceXof = integer("price_xof")
    val durationMinutes = integer("duration_minutes")
    val bandwidthLimit = text("bandwidth_limit").nullable()
    val isActive = bool("is_active").default(true)
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    val deletedAt = timestamp("deleted_at").nullable()
    override val primaryKey = PrimaryKey(id)
}

// ── Transactions ─────────────────────────────────────────────────────────────

object TransactionsTable : Table("transactions") {
    val id = uuid("id").autoGenerate()
    val operatorId = uuid("operator_id").references(OperatorsTable.id)
    val waveTransactionId = text("wave_transaction_id").uniqueIndex()
    val amountXof = integer("amount_xof")
    val status = text("status").default("PENDING")
    val phoneNumber = text("phone_number")
    val planId = uuid("plan_id").references(PlansTable.id).nullable()
    val routerId = uuid("router_id").references(RoutersTable.id).nullable()
    val idempotencyKey = text("idempotency_key").uniqueIndex()
    val rawWebhookPayload = text("raw_webhook_payload").nullable()
    val webhookReceivedAt = timestamp("webhook_received_at").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

// ── Vouchers ─────────────────────────────────────────────────────────────────

object VouchersTable : Table("vouchers") {
    val id = uuid("id").autoGenerate()
    val operatorId = uuid("operator_id").references(OperatorsTable.id)
    val transactionId = uuid("transaction_id").references(TransactionsTable.id).nullable()
    val planId = uuid("plan_id").references(PlansTable.id)
    val routerId = uuid("router_id").references(RoutersTable.id)
    val code = text("code").uniqueIndex()
    val hotspotUsername = text("hotspot_username")
    val hotspotPassword = text("hotspot_password")
    val status = text("status").default("PENDING")
    val activatedAt = timestamp("activated_at").nullable()
    val expiresAt = timestamp("expires_at").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

// ── Sessions ─────────────────────────────────────────────────────────────────

object SessionsTable : Table("sessions") {
    val id = uuid("id").autoGenerate()
    val routerId = uuid("router_id").references(RoutersTable.id)
    val voucherId = uuid("voucher_id").references(VouchersTable.id).nullable()
    val macAddress = text("mac_address")
    val ipAddress = text("ip_address").nullable()
    val bytesIn = long("bytes_in").default(0)
    val bytesOut = long("bytes_out").default(0)
    val uptimeSecs = integer("uptime_secs").default(0)
    val isActive = bool("is_active").default(true)
    val startedAt = timestamp("started_at")
    val endedAt = timestamp("ended_at").nullable()
    val createdAt = timestamp("created_at")
    val updatedAt = timestamp("updated_at")
    override val primaryKey = PrimaryKey(id)
}

// ── Audit Logs ───────────────────────────────────────────────────────────────

object AuditLogsTable : Table("audit_logs") {
    val id = uuid("id").autoGenerate()
    val operatorId = uuid("operator_id").references(OperatorsTable.id).nullable()
    val actorId = uuid("actor_id").nullable()
    val action = text("action")
    val resource = text("resource")
    val resourceId = uuid("resource_id").nullable()
    val metadata = text("metadata").default("{}")
    val ipAddress = text("ip_address").nullable()
    val createdAt = timestamp("created_at")
    override val primaryKey = PrimaryKey(id)
}

// ── Outbox ───────────────────────────────────────────────────────────────────

object OutboxEventsTable : Table("outbox_events") {
    val id = uuid("id").autoGenerate()
    val aggregateType = text("aggregate_type")
    val aggregateId = uuid("aggregate_id")
    val eventType = text("event_type")
    val payload = text("payload")
    val published = bool("published").default(false)
    val createdAt = timestamp("created_at")
    val publishedAt = timestamp("published_at").nullable()
    override val primaryKey = PrimaryKey(id)
}
