package com.mikroserver.application.usecases.router

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.core.read.ListAppender
import com.mikroserver.domain.entities.Router
import com.mikroserver.domain.entities.RouterStatus
import com.mikroserver.domain.events.DomainEvent
import com.mikroserver.domain.repositories.OutboxEvent
import com.mikroserver.domain.repositories.OutboxRepository
import com.mikroserver.domain.repositories.RouterRepository
import com.mikroserver.infrastructure.allocation.IpAllocator
import com.mikroserver.infrastructure.allocation.PortAllocator
import com.mikroserver.infrastructure.persistence.TransactionRunner
import com.mikroserver.infrastructure.routeros.DefaultRouterOsScriptBuilder
import com.mikroserver.infrastructure.security.RouterTokenService
import com.mikroserver.infrastructure.wireguard.BouncyCastleWireGuardKeyGenerator
import com.mikroserver.infrastructure.wireguard.InMemoryWgPeerManager
import com.mikroserver.shared.AppConfig
import com.mikroserver.shared.AppResult
import com.mikroserver.shared.CorsConfig
import com.mikroserver.shared.DatabaseConfig
import com.mikroserver.shared.JwtConfig
import com.mikroserver.shared.RedisConfig
import com.mikroserver.shared.WaveConfig
import com.mikroserver.shared.WireGuardConfig
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Test
import org.slf4j.LoggerFactory
import java.util.UUID

class ProvisioningServiceTest {

    private val config = AppConfig(
        database = DatabaseConfig("", "", "", 1),
        redis = RedisConfig(""),
        jwt = JwtConfig("", "", "", "", 15, 30),
        wave = WaveConfig("secret", "", null),
        wireguard = WireGuardConfig("wg0", "10.66.66.1", "10.66.66.0/24", 51820, "203.0.113.10:51820", "SERVERPUB=", "hb-secret"),
        cors = CorsConfig(emptyList()),
        environment = "test",
    )

    private fun service(
        repo: RouterRepository = InMemoryRouterRepository(),
        wg: InMemoryWgPeerManager = InMemoryWgPeerManager(),
        ip: String = "10.66.66.10",
        port: Int = 19000,
    ) = ProvisioningService(
        transactionRunner = PassThroughRunner,
        routerRepository = repo,
        outboxRepository = NoopOutbox,
        ipAllocator = FixedIpAllocator(ip),
        portAllocator = FixedPortAllocator(port),
        keyGenerator = BouncyCastleWireGuardKeyGenerator(),
        wgPeerManager = wg,
        scriptBuilder = DefaultRouterOsScriptBuilder(),
        tokenService = RouterTokenService(config.wireguard.heartbeatSecret),
        config = config,
    )

    private val operatorId = UUID.randomUUID()

    @Test
    fun `provision returns a script with IP, port and management URL`() = runTest {
        val repo = InMemoryRouterRepository()
        val result = service(repo).provision(operatorId, "Boutique Cocody")
        result as AppResult.Ok
        result.value.expectedIp shouldBe "10.66.66.10"
        result.value.dnatPortBase shouldBe 19000
        result.value.publicManagementUrl shouldBe "http://203.0.113.10:19000"
        result.value.provisioningScript shouldContain "10.66.66.10/24"
        // Only the public key is persisted.
        val stored = repo.byId.values.single()
        stored.status shouldBe RouterStatus.PROVISIONING
        stored.wgPublicKey.isNotEmpty().shouldBeTrue()
    }

    @Test
    fun `provision never leaks the private key into any log line`() = runTest {
        val appender = attachRootAppender()
        val result = service().provision(operatorId, "Boutique") as AppResult.Ok

        val privateKey = Regex("""private-key="([^"]+)"""").find(result.value.provisioningScript)!!.groupValues[1]
        privateKey.isNotEmpty().shouldBeTrue()

        val leaked = appender.list.any { e ->
            e.formattedMessage.contains(privateKey) ||
                e.argumentArray?.any { it?.toString()?.contains(privateKey) == true } == true
        }
        leaked shouldBe false
        detachRootAppender(appender)
    }

    @Test
    fun `reprovision keeps IP and port, rotates the key`() = runTest {
        val repo = InMemoryRouterRepository()
        val wg = InMemoryWgPeerManager()
        val svc = service(repo, wg)
        val first = svc.provision(operatorId, "Shop") as AppResult.Ok
        val firstKey = repo.byId.values.single().wgPublicKey

        val again = svc.reprovision(first.value.routerId, operatorId) as AppResult.Ok
        again.value.expectedIp shouldBe first.value.expectedIp
        again.value.dnatPortBase shouldBe first.value.dnatPortBase
        val newKey = repo.byId.values.single().wgPublicKey
        (newKey != firstKey).shouldBeTrue()
        wg.peers.values.single().first shouldBe newKey
    }

    @Test
    fun `revoke marks the router REVOKED and drops the peer`() = runTest {
        val repo = InMemoryRouterRepository()
        val wg = InMemoryWgPeerManager()
        val svc = service(repo, wg)
        val id = (svc.provision(operatorId, "Shop") as AppResult.Ok).value.routerId

        svc.revoke(id, operatorId) as AppResult.Ok
        repo.byId.getValue(id).status shouldBe RouterStatus.REVOKED
        wg.peers.isEmpty().shouldBeTrue()
    }

    @Test
    fun `reprovision by a different operator is forbidden`() = runTest {
        val repo = InMemoryRouterRepository()
        val svc = service(repo)
        val id = (svc.provision(operatorId, "Shop") as AppResult.Ok).value.routerId

        svc.reprovision(id, UUID.randomUUID()) as AppResult.Err
    }

    @Test
    fun `heartbeat with a valid token flips the router to ACTIVE`() = runTest {
        val repo = InMemoryRouterRepository()
        val svc = service(repo)
        val id = (svc.provision(operatorId, "Shop") as AppResult.Ok).value.routerId
        val pub = repo.byId.getValue(id).wgPublicKey
        val token = RouterTokenService(config.wireguard.heartbeatSecret).tokenFor(pub)

        svc.recordHeartbeat(id, token) as AppResult.Ok
        repo.byId.getValue(id).status shouldBe RouterStatus.ACTIVE
    }

    @Test
    fun `heartbeat with a bad token is unauthorized`() = runTest {
        val repo = InMemoryRouterRepository()
        val svc = service(repo)
        val id = (svc.provision(operatorId, "Shop") as AppResult.Ok).value.routerId

        svc.recordHeartbeat(id, "deadbeef") as AppResult.Err
    }

    // ── Test doubles ──────────────────────────────────────────────────────────

    private fun attachRootAppender(): ListAppender<ILoggingEvent> {
        val root = LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME) as Logger
        root.level = Level.TRACE
        return ListAppender<ILoggingEvent>().apply { start(); root.addAppender(this) }
    }

    private fun detachRootAppender(appender: ListAppender<ILoggingEvent>) {
        (LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME) as Logger).detachAppender(appender)
    }
}

private object PassThroughRunner : TransactionRunner {
    override suspend fun <T> inTransaction(block: suspend () -> T): T = block()
}

private class FixedIpAllocator(private val ip: String) : IpAllocator {
    override fun allocate(): AppResult<String> = AppResult.ok(ip)
}

private class FixedPortAllocator(private val port: Int) : PortAllocator {
    override fun allocate(): AppResult<Int> = AppResult.ok(port)
}

private object NoopOutbox : OutboxRepository {
    override suspend fun save(event: DomainEvent) {}
    override suspend fun findUnpublished(limit: Int): List<OutboxEvent> = emptyList()
    override suspend fun markPublished(ids: List<UUID>) {}
}

private class InMemoryRouterRepository : RouterRepository {
    val byId = mutableMapOf<UUID, Router>()
    override suspend fun findById(id: UUID): Router? = byId[id]?.takeIf { it.deletedAt == null }
    override suspend fun findByOperatorId(operatorId: UUID): List<Router> =
        byId.values.filter { it.operatorId == operatorId && it.deletedAt == null }
    override suspend fun findOnlineRouters(): List<Router> = emptyList()
    override suspend fun findMaxWgIp(): String? = null
    override suspend fun findMaxDnatPortBase(): Int? = null
    override suspend fun create(router: Router): Router { byId[router.id] = router; return router }
    override suspend fun update(router: Router): Router { byId[router.id] = router; return router }
}
