package com.mikroserver.domain.entities

import kotlinx.datetime.Instant
import java.util.UUID

data class Operator(
    val id: UUID,
    val name: String,
    val slug: String,
    val tier: OperatorTier,
    val isActive: Boolean,
    val createdAt: Instant,
    val updatedAt: Instant,
    val deletedAt: Instant? = null,
)

data class User(
    val id: UUID,
    val operatorId: UUID,
    val email: String,
    val passwordHash: String,
    val role: UserRole,
    val isActive: Boolean,
    val createdAt: Instant,
    val updatedAt: Instant,
    val deletedAt: Instant? = null,
)

data class Router(
    val id: UUID,
    val operatorId: UUID,
    val name: String,
    val macAddress: String?,
    val wgPublicKey: String,
    val wgAllowedIp: String,
    val wgEndpoint: String?,
    val apiPort: Int,
    val apiUsername: String,
    val apiPasswordEnc: String?,
    val status: RouterStatus,
    val lastHandshakeAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
    val deletedAt: Instant? = null,
)

data class Plan(
    val id: UUID,
    val operatorId: UUID,
    val name: String,
    val priceXof: Int,
    val durationMinutes: Int,
    val bandwidthLimit: String?,
    val isActive: Boolean,
    val createdAt: Instant,
    val updatedAt: Instant,
    val deletedAt: Instant? = null,
)

data class Transaction(
    val id: UUID,
    val operatorId: UUID,
    val waveTransactionId: String,
    val amountXof: Int,
    val status: TransactionStatus,
    val phoneNumber: String,
    val planId: UUID?,
    val routerId: UUID?,
    val idempotencyKey: String,
    val rawWebhookPayload: String?,
    val webhookReceivedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class Voucher(
    val id: UUID,
    val operatorId: UUID,
    val transactionId: UUID?,
    val planId: UUID,
    val routerId: UUID,
    val code: String,
    val hotspotUsername: String,
    val hotspotPassword: String,
    val status: VoucherStatus,
    val activatedAt: Instant?,
    val expiresAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class HotspotSession(
    val id: UUID,
    val routerId: UUID,
    val voucherId: UUID?,
    val macAddress: String,
    val ipAddress: String?,
    val bytesIn: Long,
    val bytesOut: Long,
    val uptimeSecs: Int,
    val isActive: Boolean,
    val startedAt: Instant,
    val endedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

data class RefreshToken(
    val id: UUID,
    val userId: UUID,
    val tokenHash: String,
    val familyId: UUID,
    val rotatedAt: Instant?,
    val revokedAt: Instant?,
    val expiresAt: Instant,
    val createdAt: Instant,
)

data class AuditLog(
    val id: UUID,
    val operatorId: UUID?,
    val actorId: UUID?,
    val action: String,
    val resource: String,
    val resourceId: UUID?,
    val metadata: String,
    val ipAddress: String?,
    val createdAt: Instant,
)
