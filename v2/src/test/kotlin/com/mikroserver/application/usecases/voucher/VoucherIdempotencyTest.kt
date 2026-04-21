package com.mikroserver.application.usecases.voucher

import com.mikroserver.domain.entities.*
import com.mikroserver.domain.events.DomainEvent
import com.mikroserver.domain.repositories.*
import com.mikroserver.infrastructure.resilience.RouterCircuitBreakerRegistry
import com.mikroserver.infrastructure.routeros.HotspotActiveSession
import com.mikroserver.infrastructure.routeros.RouterOsClient
import com.mikroserver.shared.AppResult
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.Clock
import org.junit.jupiter.api.Test
import java.util.UUID

class VoucherIdempotencyTest {

    private val now = Clock.System.now()
    private val operatorId = UUID.randomUUID()
    private val planId = UUID.randomUUID()
    private val routerId = UUID.randomUUID()
    private val transactionId = UUID.randomUUID()

    private val testPlan = Plan(
        id = planId, operatorId = operatorId, name = "Test",
        priceXof = 500, durationMinutes = 60, bandwidthLimit = "2M/1M",
        isActive = true, createdAt = now, updatedAt = now,
    )

    private val testRouter = Router(
        id = routerId, operatorId = operatorId, name = "TestRouter",
        macAddress = null, wgPublicKey = "pubkey", wgAllowedIp = "10.66.66.2",
        wgEndpoint = null, apiPort = 8728, apiUsername = "admin", apiPasswordEnc = null,
        status = RouterStatus.ONLINE, lastHandshakeAt = now, createdAt = now, updatedAt = now,
    )

    private val existingVoucher = Voucher(
        id = UUID.randomUUID(), operatorId = operatorId, transactionId = transactionId,
        planId = planId, routerId = routerId, code = "EXISTING1", hotspotUsername = "v-EXISTING1",
        hotspotPassword = "pass123", status = VoucherStatus.ACTIVE, activatedAt = now,
        expiresAt = now, createdAt = now, updatedAt = now,
    )

    @Test
    fun `returns existing voucher when transaction already has one`() = runTest {
        val voucherRepo = object : VoucherRepository {
            override suspend fun findByTransactionId(transactionId: UUID) = existingVoucher
            override suspend fun findById(id: UUID) = null
            override suspend fun findByCode(code: String) = null
            override suspend fun create(voucher: Voucher) = voucher
            override suspend fun update(voucher: Voucher) = voucher
        }

        val planRepo = object : PlanRepository {
            override suspend fun findById(id: UUID) = testPlan
            override suspend fun findByOperatorId(operatorId: UUID) = listOf(testPlan)
            override suspend fun findByPriceAndOperator(priceXof: Int, operatorId: UUID) = testPlan
            override suspend fun create(plan: Plan) = plan
        }

        val routerRepo = object : RouterRepository {
            override suspend fun findById(id: UUID) = testRouter
            override suspend fun findByOperatorId(operatorId: UUID) = emptyList<Router>()
            override suspend fun findOnlineRouters() = emptyList<Router>()
            override suspend fun findMaxWgIp() = null
            override suspend fun create(router: Router) = router
            override suspend fun update(router: Router) = router
        }

        val txnRepo = object : TransactionRepository {
            override suspend fun findById(id: UUID) = null
            override suspend fun findByWaveTransactionId(waveId: String) = null
            override suspend fun findByIdempotencyKey(key: String) = null
            override suspend fun create(transaction: Transaction) = transaction
            override suspend fun update(transaction: Transaction) = transaction
        }

        val outbox = object : OutboxRepository {
            override suspend fun save(event: DomainEvent) {}
            override suspend fun findUnpublished(limit: Int) = emptyList<OutboxEvent>()
            override suspend fun markPublished(ids: List<UUID>) {}
        }

        val routerOsClient = object : RouterOsClient {
            var callCount = 0
            override suspend fun login(host: String, port: Int, username: String, password: String) = AppResult.ok(Unit)
            override suspend fun addHotspotUser(host: String, port: Int, username: String, password: String, routerUser: String, routerPass: String, hotspotUsername: String, hotspotPassword: String, rateLimit: String?, uptimeLimit: String?): AppResult<String> {
                callCount++
                return AppResult.ok("*1")
            }
            override suspend fun removeHotspotUser(host: String, port: Int, username: String, password: String, routerUser: String, routerPass: String, hotspotUsername: String) = AppResult.ok(Unit)
            override suspend fun getActiveHotspotSessions(host: String, port: Int, username: String, password: String) = AppResult.ok(emptyList<HotspotActiveSession>())
        }

        val useCase = GenerateVoucherUseCase(
            voucherRepo, txnRepo, planRepo, routerRepo, outbox,
            routerOsClient, RouterCircuitBreakerRegistry(),
        )

        val result = useCase.execute(
            GenerateVoucherUseCase.Command(transactionId, operatorId, planId, routerId),
        )

        result.isOk shouldBe true
        result.getOrThrow().code shouldBe "EXISTING1"
        routerOsClient.callCount shouldBe 0 // RouterOS was NOT called — idempotent
    }
}
