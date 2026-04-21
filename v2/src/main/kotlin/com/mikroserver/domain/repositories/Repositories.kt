package com.mikroserver.domain.repositories

import com.mikroserver.domain.entities.*
import com.mikroserver.domain.events.DomainEvent
import java.util.UUID

/** Port: operator persistence. */
interface OperatorRepository {
    suspend fun findById(id: UUID): Operator?
    suspend fun findBySlug(slug: String): Operator?
    suspend fun create(operator: Operator): Operator
    suspend fun update(operator: Operator): Operator
}

/** Port: user persistence. */
interface UserRepository {
    suspend fun findById(id: UUID): User?
    suspend fun findByEmail(email: String): User?
    suspend fun findByOperatorId(operatorId: UUID): List<User>
    suspend fun create(user: User): User
    suspend fun update(user: User): User
}

/** Port: router persistence. */
interface RouterRepository {
    suspend fun findById(id: UUID): Router?
    suspend fun findByOperatorId(operatorId: UUID): List<Router>
    suspend fun findOnlineRouters(): List<Router>
    suspend fun findMaxWgIp(): String?
    suspend fun create(router: Router): Router
    suspend fun update(router: Router): Router
}

/** Port: plan persistence. */
interface PlanRepository {
    suspend fun findById(id: UUID): Plan?
    suspend fun findByOperatorId(operatorId: UUID): List<Plan>
    suspend fun findByPriceAndOperator(priceXof: Int, operatorId: UUID): Plan?
    suspend fun create(plan: Plan): Plan
}

/** Port: transaction persistence. */
interface TransactionRepository {
    suspend fun findById(id: UUID): Transaction?
    suspend fun findByWaveTransactionId(waveId: String): Transaction?
    suspend fun findByIdempotencyKey(key: String): Transaction?
    suspend fun create(transaction: Transaction): Transaction
    suspend fun update(transaction: Transaction): Transaction
}

/** Port: voucher persistence. */
interface VoucherRepository {
    suspend fun findById(id: UUID): Voucher?
    suspend fun findByTransactionId(transactionId: UUID): Voucher?
    suspend fun findByCode(code: String): Voucher?
    suspend fun create(voucher: Voucher): Voucher
    suspend fun update(voucher: Voucher): Voucher
}

/** Port: hotspot session persistence. */
interface SessionRepository {
    suspend fun findActiveByRouter(routerId: UUID): List<HotspotSession>
    suspend fun upsertByMacAndRouter(session: HotspotSession): HotspotSession
    suspend fun deactivateStale(routerId: UUID, activeMacs: Set<String>)
}

/** Port: refresh token persistence. */
interface RefreshTokenRepository {
    suspend fun findByTokenHash(hash: String): RefreshToken?
    suspend fun findByFamilyId(familyId: UUID): List<RefreshToken>
    suspend fun create(token: RefreshToken): RefreshToken
    suspend fun revokeByFamilyId(familyId: UUID)
    suspend fun revokeById(id: UUID)
}

/** Port: audit log persistence (append-only). */
interface AuditLogRepository {
    suspend fun append(log: AuditLog)
    suspend fun findByOperator(operatorId: UUID, limit: Int = 100, offset: Int = 0): List<AuditLog>
}

/** Port: outbox event persistence. */
interface OutboxRepository {
    suspend fun save(event: DomainEvent)
    suspend fun findUnpublished(limit: Int = 50): List<OutboxEvent>
    suspend fun markPublished(ids: List<UUID>)
}

data class OutboxEvent(
    val id: UUID,
    val aggregateType: String,
    val aggregateId: UUID,
    val eventType: String,
    val payload: String,
    val published: Boolean,
)
