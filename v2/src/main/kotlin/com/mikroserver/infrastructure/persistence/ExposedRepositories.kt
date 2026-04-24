package com.mikroserver.infrastructure.persistence

import com.mikroserver.domain.entities.*
import com.mikroserver.domain.events.DomainEvent
import com.mikroserver.domain.repositories.*
import com.mikroserver.infrastructure.persistence.DatabaseFactory.dbQuery
import kotlinx.datetime.Clock
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.inList
import org.jetbrains.exposed.sql.SqlExpressionBuilder.isNull
import java.util.UUID

// ── Row mappers ──────────────────────────────────────────────────────────────

private fun ResultRow.toOperator() = Operator(
    id = this[OperatorsTable.id],
    name = this[OperatorsTable.name],
    slug = this[OperatorsTable.slug],
    tier = OperatorTier.valueOf(this[OperatorsTable.tier]),
    isActive = this[OperatorsTable.isActive],
    createdAt = this[OperatorsTable.createdAt],
    updatedAt = this[OperatorsTable.updatedAt],
    deletedAt = this[OperatorsTable.deletedAt],
)

private fun ResultRow.toUser() = User(
    id = this[UsersTable.id],
    operatorId = this[UsersTable.operatorId],
    email = this[UsersTable.email],
    passwordHash = this[UsersTable.passwordHash],
    role = UserRole.valueOf(this[UsersTable.role]),
    isActive = this[UsersTable.isActive],
    createdAt = this[UsersTable.createdAt],
    updatedAt = this[UsersTable.updatedAt],
    deletedAt = this[UsersTable.deletedAt],
)

private fun ResultRow.toRouter() = Router(
    id = this[RoutersTable.id],
    operatorId = this[RoutersTable.operatorId],
    name = this[RoutersTable.name],
    macAddress = this[RoutersTable.macAddress],
    wgPublicKey = this[RoutersTable.wgPublicKey],
    wgAllowedIp = this[RoutersTable.wgAllowedIp],
    wgEndpoint = this[RoutersTable.wgEndpoint],
    apiPort = this[RoutersTable.apiPort],
    apiUsername = this[RoutersTable.apiUsername],
    apiPasswordEnc = this[RoutersTable.apiPasswordEnc],
    status = RouterStatus.valueOf(this[RoutersTable.status]),
    lastHandshakeAt = this[RoutersTable.lastHandshakeAt],
    createdAt = this[RoutersTable.createdAt],
    updatedAt = this[RoutersTable.updatedAt],
    deletedAt = this[RoutersTable.deletedAt],
)

private fun ResultRow.toPlan() = Plan(
    id = this[PlansTable.id],
    operatorId = this[PlansTable.operatorId],
    name = this[PlansTable.name],
    priceXof = this[PlansTable.priceXof],
    durationMinutes = this[PlansTable.durationMinutes],
    bandwidthLimit = this[PlansTable.bandwidthLimit],
    isActive = this[PlansTable.isActive],
    createdAt = this[PlansTable.createdAt],
    updatedAt = this[PlansTable.updatedAt],
    deletedAt = this[PlansTable.deletedAt],
)

private fun ResultRow.toTransaction() = Transaction(
    id = this[TransactionsTable.id],
    operatorId = this[TransactionsTable.operatorId],
    waveTransactionId = this[TransactionsTable.waveTransactionId],
    amountXof = this[TransactionsTable.amountXof],
    status = TransactionStatus.valueOf(this[TransactionsTable.status]),
    phoneNumber = this[TransactionsTable.phoneNumber],
    planId = this[TransactionsTable.planId],
    routerId = this[TransactionsTable.routerId],
    idempotencyKey = this[TransactionsTable.idempotencyKey],
    rawWebhookPayload = this[TransactionsTable.rawWebhookPayload],
    webhookReceivedAt = this[TransactionsTable.webhookReceivedAt],
    createdAt = this[TransactionsTable.createdAt],
    updatedAt = this[TransactionsTable.updatedAt],
)

private fun ResultRow.toVoucher() = Voucher(
    id = this[VouchersTable.id],
    operatorId = this[VouchersTable.operatorId],
    transactionId = this[VouchersTable.transactionId],
    planId = this[VouchersTable.planId],
    routerId = this[VouchersTable.routerId],
    code = this[VouchersTable.code],
    hotspotUsername = this[VouchersTable.hotspotUsername],
    hotspotPassword = this[VouchersTable.hotspotPassword],
    status = VoucherStatus.valueOf(this[VouchersTable.status]),
    activatedAt = this[VouchersTable.activatedAt],
    expiresAt = this[VouchersTable.expiresAt],
    createdAt = this[VouchersTable.createdAt],
    updatedAt = this[VouchersTable.updatedAt],
)

private fun ResultRow.toSession() = HotspotSession(
    id = this[SessionsTable.id],
    routerId = this[SessionsTable.routerId],
    voucherId = this[SessionsTable.voucherId],
    macAddress = this[SessionsTable.macAddress],
    ipAddress = this[SessionsTable.ipAddress],
    bytesIn = this[SessionsTable.bytesIn],
    bytesOut = this[SessionsTable.bytesOut],
    uptimeSecs = this[SessionsTable.uptimeSecs],
    isActive = this[SessionsTable.isActive],
    startedAt = this[SessionsTable.startedAt],
    endedAt = this[SessionsTable.endedAt],
    createdAt = this[SessionsTable.createdAt],
    updatedAt = this[SessionsTable.updatedAt],
)

private fun ResultRow.toRefreshToken() = RefreshToken(
    id = this[RefreshTokensTable.id],
    userId = this[RefreshTokensTable.userId],
    tokenHash = this[RefreshTokensTable.tokenHash],
    familyId = this[RefreshTokensTable.familyId],
    rotatedAt = this[RefreshTokensTable.rotatedAt],
    revokedAt = this[RefreshTokensTable.revokedAt],
    expiresAt = this[RefreshTokensTable.expiresAt],
    createdAt = this[RefreshTokensTable.createdAt],
)

private fun ResultRow.toAuditLog() = AuditLog(
    id = this[AuditLogsTable.id],
    operatorId = this[AuditLogsTable.operatorId],
    actorId = this[AuditLogsTable.actorId],
    action = this[AuditLogsTable.action],
    resource = this[AuditLogsTable.resource],
    resourceId = this[AuditLogsTable.resourceId],
    metadata = this[AuditLogsTable.metadata],
    ipAddress = this[AuditLogsTable.ipAddress],
    createdAt = this[AuditLogsTable.createdAt],
)

// ── Repository implementations ───────────────────────────────────────────────

class ExposedOperatorRepository : OperatorRepository {
    override suspend fun findById(id: UUID): Operator? = dbQuery {
        OperatorsTable.selectAll()
            .where { (OperatorsTable.id eq id) and OperatorsTable.deletedAt.isNull() }
            .firstOrNull()?.toOperator()
    }

    override suspend fun findBySlug(slug: String): Operator? = dbQuery {
        OperatorsTable.selectAll()
            .where { (OperatorsTable.slug eq slug) and OperatorsTable.deletedAt.isNull() }
            .firstOrNull()?.toOperator()
    }

    override suspend fun create(operator: Operator): Operator = dbQuery {
        OperatorsTable.insert {
            it[id] = operator.id
            it[name] = operator.name
            it[slug] = operator.slug
            it[tier] = operator.tier.name
            it[isActive] = operator.isActive
            it[createdAt] = operator.createdAt
            it[updatedAt] = operator.updatedAt
        }
        operator
    }

    override suspend fun update(operator: Operator): Operator = dbQuery {
        OperatorsTable.update({ OperatorsTable.id eq operator.id }) {
            it[name] = operator.name
            it[slug] = operator.slug
            it[tier] = operator.tier.name
            it[isActive] = operator.isActive
            it[deletedAt] = operator.deletedAt
        }
        operator
    }
}

class ExposedUserRepository : UserRepository {
    override suspend fun findById(id: UUID): User? = dbQuery {
        UsersTable.selectAll()
            .where { (UsersTable.id eq id) and UsersTable.deletedAt.isNull() }
            .firstOrNull()?.toUser()
    }

    override suspend fun findByEmail(email: String): User? = dbQuery {
        UsersTable.selectAll()
            .where { (UsersTable.email eq email) and UsersTable.deletedAt.isNull() }
            .firstOrNull()?.toUser()
    }

    override suspend fun findByOperatorId(operatorId: UUID): List<User> = dbQuery {
        UsersTable.selectAll()
            .where { (UsersTable.operatorId eq operatorId) and UsersTable.deletedAt.isNull() }
            .map { it.toUser() }
    }

    override suspend fun create(user: User): User = dbQuery {
        UsersTable.insert {
            it[id] = user.id
            it[operatorId] = user.operatorId
            it[email] = user.email
            it[passwordHash] = user.passwordHash
            it[role] = user.role.name
            it[isActive] = user.isActive
            it[createdAt] = user.createdAt
            it[updatedAt] = user.updatedAt
        }
        user
    }

    override suspend fun update(user: User): User = dbQuery {
        UsersTable.update({ UsersTable.id eq user.id }) {
            it[email] = user.email
            it[passwordHash] = user.passwordHash
            it[role] = user.role.name
            it[isActive] = user.isActive
            it[deletedAt] = user.deletedAt
        }
        user
    }
}

class ExposedRouterRepository : RouterRepository {
    override suspend fun findById(id: UUID): Router? = dbQuery {
        RoutersTable.selectAll()
            .where { (RoutersTable.id eq id) and RoutersTable.deletedAt.isNull() }
            .firstOrNull()?.toRouter()
    }

    override suspend fun findByOperatorId(operatorId: UUID): List<Router> = dbQuery {
        RoutersTable.selectAll()
            .where { (RoutersTable.operatorId eq operatorId) and RoutersTable.deletedAt.isNull() }
            .map { it.toRouter() }
    }

    override suspend fun findOnlineRouters(): List<Router> = dbQuery {
        RoutersTable.selectAll()
            .where {
                (RoutersTable.status inList listOf("ONLINE", "DEGRADED")) and
                    RoutersTable.deletedAt.isNull()
            }
            .map { it.toRouter() }
    }

    override suspend fun findMaxWgIp(): String? = dbQuery {
        RoutersTable.select(RoutersTable.wgAllowedIp)
            .where { RoutersTable.deletedAt.isNull() }
            .orderBy(RoutersTable.wgAllowedIp, SortOrder.DESC)
            .limit(1)
            .firstOrNull()
            ?.get(RoutersTable.wgAllowedIp)
    }

    override suspend fun create(router: Router): Router = dbQuery {
        RoutersTable.insert {
            it[id] = router.id
            it[operatorId] = router.operatorId
            it[name] = router.name
            it[macAddress] = router.macAddress
            it[wgPublicKey] = router.wgPublicKey
            it[wgAllowedIp] = router.wgAllowedIp
            it[wgEndpoint] = router.wgEndpoint
            it[apiPort] = router.apiPort
            it[apiUsername] = router.apiUsername
            it[apiPasswordEnc] = router.apiPasswordEnc
            it[status] = router.status.name
            it[createdAt] = router.createdAt
            it[updatedAt] = router.updatedAt
        }
        router
    }

    override suspend fun update(router: Router): Router = dbQuery {
        RoutersTable.update({ RoutersTable.id eq router.id }) {
            it[name] = router.name
            it[macAddress] = router.macAddress
            it[status] = router.status.name
            it[lastHandshakeAt] = router.lastHandshakeAt
            it[deletedAt] = router.deletedAt
        }
        router
    }
}

class ExposedPlanRepository : PlanRepository {
    override suspend fun findById(id: UUID): Plan? = dbQuery {
        PlansTable.selectAll()
            .where { (PlansTable.id eq id) and PlansTable.deletedAt.isNull() }
            .firstOrNull()?.toPlan()
    }

    override suspend fun findByOperatorId(operatorId: UUID): List<Plan> = dbQuery {
        PlansTable.selectAll()
            .where { (PlansTable.operatorId eq operatorId) and PlansTable.deletedAt.isNull() }
            .map { it.toPlan() }
    }

    override suspend fun findByPriceAndOperator(priceXof: Int, operatorId: UUID): Plan? = dbQuery {
        PlansTable.selectAll()
            .where {
                (PlansTable.priceXof eq priceXof) and
                    (PlansTable.operatorId eq operatorId) and
                    (PlansTable.isActive eq true) and
                    PlansTable.deletedAt.isNull()
            }
            .firstOrNull()?.toPlan()
    }

    override suspend fun create(plan: Plan): Plan = dbQuery {
        PlansTable.insert {
            it[id] = plan.id
            it[operatorId] = plan.operatorId
            it[name] = plan.name
            it[priceXof] = plan.priceXof
            it[durationMinutes] = plan.durationMinutes
            it[bandwidthLimit] = plan.bandwidthLimit
            it[isActive] = plan.isActive
            it[createdAt] = plan.createdAt
            it[updatedAt] = plan.updatedAt
        }
        plan
    }
}

class ExposedTransactionRepository : TransactionRepository {
    override suspend fun findById(id: UUID): Transaction? = dbQuery {
        TransactionsTable.selectAll()
            .where { TransactionsTable.id eq id }
            .firstOrNull()?.toTransaction()
    }

    override suspend fun findByWaveTransactionId(waveId: String): Transaction? = dbQuery {
        TransactionsTable.selectAll()
            .where { TransactionsTable.waveTransactionId eq waveId }
            .firstOrNull()?.toTransaction()
    }

    override suspend fun findByIdempotencyKey(key: String): Transaction? = dbQuery {
        TransactionsTable.selectAll()
            .where { TransactionsTable.idempotencyKey eq key }
            .firstOrNull()?.toTransaction()
    }

    override suspend fun create(transaction: Transaction): Transaction = dbQuery {
        TransactionsTable.insert {
            it[id] = transaction.id
            it[operatorId] = transaction.operatorId
            it[waveTransactionId] = transaction.waveTransactionId
            it[amountXof] = transaction.amountXof
            it[status] = transaction.status.name
            it[phoneNumber] = transaction.phoneNumber
            it[planId] = transaction.planId
            it[routerId] = transaction.routerId
            it[idempotencyKey] = transaction.idempotencyKey
            it[rawWebhookPayload] = transaction.rawWebhookPayload
            it[webhookReceivedAt] = transaction.webhookReceivedAt
            it[createdAt] = transaction.createdAt
            it[updatedAt] = transaction.updatedAt
        }
        transaction
    }

    override suspend fun update(transaction: Transaction): Transaction = dbQuery {
        TransactionsTable.update({ TransactionsTable.id eq transaction.id }) {
            it[status] = transaction.status.name
            it[planId] = transaction.planId
            it[routerId] = transaction.routerId
            it[rawWebhookPayload] = transaction.rawWebhookPayload
            it[webhookReceivedAt] = transaction.webhookReceivedAt
        }
        transaction
    }
}

class ExposedVoucherRepository : VoucherRepository {
    override suspend fun findById(id: UUID): Voucher? = dbQuery {
        VouchersTable.selectAll()
            .where { VouchersTable.id eq id }
            .firstOrNull()?.toVoucher()
    }

    override suspend fun findByTransactionId(transactionId: UUID): Voucher? = dbQuery {
        VouchersTable.selectAll()
            .where { VouchersTable.transactionId eq transactionId }
            .firstOrNull()?.toVoucher()
    }

    override suspend fun findByCode(code: String): Voucher? = dbQuery {
        VouchersTable.selectAll()
            .where { VouchersTable.code eq code }
            .firstOrNull()?.toVoucher()
    }

    override suspend fun create(voucher: Voucher): Voucher = dbQuery {
        VouchersTable.insert {
            it[id] = voucher.id
            it[operatorId] = voucher.operatorId
            it[transactionId] = voucher.transactionId
            it[planId] = voucher.planId
            it[routerId] = voucher.routerId
            it[code] = voucher.code
            it[hotspotUsername] = voucher.hotspotUsername
            it[hotspotPassword] = voucher.hotspotPassword
            it[status] = voucher.status.name
            it[activatedAt] = voucher.activatedAt
            it[expiresAt] = voucher.expiresAt
            it[createdAt] = voucher.createdAt
            it[updatedAt] = voucher.updatedAt
        }
        voucher
    }

    override suspend fun update(voucher: Voucher): Voucher = dbQuery {
        VouchersTable.update({ VouchersTable.id eq voucher.id }) {
            it[status] = voucher.status.name
            it[activatedAt] = voucher.activatedAt
            it[expiresAt] = voucher.expiresAt
        }
        voucher
    }
}

class ExposedSessionRepository : SessionRepository {
    override suspend fun findActiveByRouter(routerId: UUID): List<HotspotSession> = dbQuery {
        SessionsTable.selectAll()
            .where { (SessionsTable.routerId eq routerId) and (SessionsTable.isActive eq true) }
            .map { it.toSession() }
    }

    override suspend fun upsertByMacAndRouter(session: HotspotSession): HotspotSession = dbQuery {
        val existing = SessionsTable.selectAll()
            .where {
                (SessionsTable.routerId eq session.routerId) and
                    (SessionsTable.macAddress eq session.macAddress) and
                    (SessionsTable.isActive eq true)
            }
            .firstOrNull()

        if (existing != null) {
            SessionsTable.update({
                (SessionsTable.routerId eq session.routerId) and
                    (SessionsTable.macAddress eq session.macAddress) and
                    (SessionsTable.isActive eq true)
            }) {
                it[bytesIn] = session.bytesIn
                it[bytesOut] = session.bytesOut
                it[uptimeSecs] = session.uptimeSecs
                it[ipAddress] = session.ipAddress
            }
            session.copy(id = existing[SessionsTable.id])
        } else {
            SessionsTable.insert {
                it[id] = session.id
                it[routerId] = session.routerId
                it[voucherId] = session.voucherId
                it[macAddress] = session.macAddress
                it[ipAddress] = session.ipAddress
                it[bytesIn] = session.bytesIn
                it[bytesOut] = session.bytesOut
                it[uptimeSecs] = session.uptimeSecs
                it[isActive] = true
                it[startedAt] = session.startedAt
                it[createdAt] = session.createdAt
                it[updatedAt] = session.updatedAt
            }
            session
        }
    }

    override suspend fun deactivateStale(routerId: UUID, activeMacs: Set<String>) = dbQuery {
        SessionsTable.update({
            (SessionsTable.routerId eq routerId) and
                (SessionsTable.isActive eq true) and
                (SessionsTable.macAddress notInList activeMacs)
        }) {
            it[isActive] = false
            it[endedAt] = Clock.System.now()
        }
        Unit
    }
}

class ExposedRefreshTokenRepository : RefreshTokenRepository {
    override suspend fun findByTokenHash(hash: String): RefreshToken? = dbQuery {
        RefreshTokensTable.selectAll()
            .where { RefreshTokensTable.tokenHash eq hash }
            .firstOrNull()?.toRefreshToken()
    }

    override suspend fun findByFamilyId(familyId: UUID): List<RefreshToken> = dbQuery {
        RefreshTokensTable.selectAll()
            .where { RefreshTokensTable.familyId eq familyId }
            .map { it.toRefreshToken() }
    }

    override suspend fun create(token: RefreshToken): RefreshToken = dbQuery {
        RefreshTokensTable.insert {
            it[id] = token.id
            it[userId] = token.userId
            it[tokenHash] = token.tokenHash
            it[familyId] = token.familyId
            it[rotatedAt] = token.rotatedAt
            it[revokedAt] = token.revokedAt
            it[expiresAt] = token.expiresAt
            it[createdAt] = token.createdAt
        }
        token
    }

    override suspend fun revokeByFamilyId(familyId: UUID) = dbQuery {
        RefreshTokensTable.update({ RefreshTokensTable.familyId eq familyId }) {
            it[revokedAt] = Clock.System.now()
        }
        Unit
    }

    override suspend fun revokeById(id: UUID) = dbQuery {
        RefreshTokensTable.update({ RefreshTokensTable.id eq id }) {
            it[revokedAt] = Clock.System.now()
        }
        Unit
    }
}

class ExposedAuditLogRepository : AuditLogRepository {
    override suspend fun append(log: AuditLog) = dbQuery {
        AuditLogsTable.insert {
            it[id] = log.id
            it[operatorId] = log.operatorId
            it[actorId] = log.actorId
            it[action] = log.action
            it[resource] = log.resource
            it[resourceId] = log.resourceId
            it[metadata] = log.metadata
            it[ipAddress] = log.ipAddress
            it[createdAt] = log.createdAt
        }
        Unit
    }

    override suspend fun findByOperator(operatorId: UUID, limit: Int, offset: Int): List<AuditLog> = dbQuery {
        AuditLogsTable.selectAll()
            .where { AuditLogsTable.operatorId eq operatorId }
            .orderBy(AuditLogsTable.createdAt, SortOrder.DESC)
            .limit(limit).offset(offset.toLong())
            .map { it.toAuditLog() }
    }
}

class ExposedOutboxRepository(private val json: Json) : OutboxRepository {
    override suspend fun save(event: DomainEvent) = dbQuery {
        val payload = when (event) {
            is DomainEvent.RouterOnboarded -> json.encodeToString(event)
            is DomainEvent.VoucherActivated -> json.encodeToString(event)
            is DomainEvent.TransactionPaid -> json.encodeToString(event)
            is DomainEvent.RefreshTokenFamilyRevoked -> json.encodeToString(event)
            is DomainEvent.RouterStatusChanged -> json.encodeToString(event)
        }
        OutboxEventsTable.insert {
            it[id] = event.eventId
            it[aggregateType] = event.aggregateType
            it[aggregateId] = event.aggregateId
            it[eventType] = event::class.simpleName.orEmpty()
            it[OutboxEventsTable.payload] = payload
            it[published] = false
            it[createdAt] = event.occurredAt
        }
        Unit
    }

    override suspend fun findUnpublished(limit: Int): List<OutboxEvent> = dbQuery {
        OutboxEventsTable.selectAll()
            .where { OutboxEventsTable.published eq false }
            .orderBy(OutboxEventsTable.createdAt, SortOrder.ASC)
            .limit(limit)
            .map {
                OutboxEvent(
                    id = it[OutboxEventsTable.id],
                    aggregateType = it[OutboxEventsTable.aggregateType],
                    aggregateId = it[OutboxEventsTable.aggregateId],
                    eventType = it[OutboxEventsTable.eventType],
                    payload = it[OutboxEventsTable.payload],
                    published = it[OutboxEventsTable.published],
                )
            }
    }

    override suspend fun markPublished(ids: List<UUID>) = dbQuery {
        OutboxEventsTable.update({ OutboxEventsTable.id inList ids }) {
            it[published] = true
            it[publishedAt] = Clock.System.now()
        }
        Unit
    }
}
