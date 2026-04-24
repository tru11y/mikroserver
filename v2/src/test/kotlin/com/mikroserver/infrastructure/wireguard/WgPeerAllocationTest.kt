package com.mikroserver.infrastructure.wireguard

import com.mikroserver.application.usecases.router.OnboardRouterUseCase
import com.mikroserver.domain.entities.Router
import com.mikroserver.domain.entities.RouterStatus
import com.mikroserver.domain.events.DomainEvent
import com.mikroserver.domain.repositories.OutboxRepository
import com.mikroserver.domain.repositories.RouterRepository
import com.mikroserver.shared.AppConfig
import com.mikroserver.shared.AppResult
import com.mikroserver.shared.CorsConfig
import com.mikroserver.shared.DatabaseConfig
import com.mikroserver.shared.JwtConfig
import com.mikroserver.shared.RedisConfig
import com.mikroserver.shared.WaveConfig
import com.mikroserver.shared.WireGuardConfig
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.Instant
import org.junit.jupiter.api.Test
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicReference

class WgPeerAllocationTest {

    private val testConfig = AppConfig(
        database = DatabaseConfig("", "", "", 1),
        redis = RedisConfig(""),
        jwt = JwtConfig("", "", "", "", 15, 30),
        wave = WaveConfig("secret", "", null),
        wireguard = WireGuardConfig("wg0", "10.66.66.1", "10.66.66.0/24", 51820, "1.2.3.4:51820", "testpubkey"),
        cors = CorsConfig(emptyList()),
        environment = "test",
    )

    @Test
    fun `InMemoryWireGuardController tracks peers correctly`() = runTest {
        val wg = InMemoryWireGuardController()
        wg.addPeer("wg0", "pubkey1", "10.66.66.2")
        wg.addPeer("wg0", "pubkey2", "10.66.66.3")

        wg.peers.size shouldBe 2
        wg.peers["pubkey1"] shouldBe "10.66.66.2"

        wg.removePeer("wg0", "pubkey1")
        wg.peers.size shouldBe 1
    }

    @Test
    fun `InMemoryWireGuardController saveConfig records interface`() = runTest {
        val wg = InMemoryWireGuardController()
        wg.saveConfig("wg0")
        wg.saveConfig("wg0")
        wg.savedConfigs.size shouldBe 2
    }

    @Test
    fun `sequential IP allocation produces unique IPs`() = runTest {
        val allocated = ConcurrentHashMap<String, Boolean>()
        val maxIpRef = AtomicReference<String?>(null)

        val routerRepo = object : RouterRepository {
            override suspend fun findMaxWgIp(): String? = maxIpRef.get()
            override suspend fun create(router: Router): Router {
                // Simulate DB UNIQUE constraint: fail if IP already taken
                if (allocated.putIfAbsent(router.wgAllowedIp, true) != null) {
                    throw RuntimeException("Duplicate IP: ${router.wgAllowedIp}")
                }
                maxIpRef.set(router.wgAllowedIp)
                return router
            }
            override suspend fun findById(id: UUID): Router? = null
            override suspend fun findByOperatorId(operatorId: UUID): List<Router> = emptyList()
            override suspend fun findOnlineRouters(): List<Router> = emptyList()
            override suspend fun update(router: Router): Router = router
        }

        val outbox = object : OutboxRepository {
            override suspend fun save(event: DomainEvent) {}
            override suspend fun findUnpublished(limit: Int) = emptyList<com.mikroserver.domain.repositories.OutboxEvent>()
            override suspend fun markPublished(ids: List<UUID>) {}
        }

        val wg = InMemoryWireGuardController()
        val useCase = OnboardRouterUseCase(routerRepo, outbox, wg, testConfig)

        // Allocate 5 routers sequentially
        val results = (1..5).map { i ->
            useCase.execute(
                OnboardRouterUseCase.Command(
                    operatorId = UUID.randomUUID(),
                    name = "Router-$i",
                    macAddress = null,
                ),
            )
        }

        val ips = results.mapNotNull { (it as? AppResult.Ok)?.value?.wgProvision?.wgIp }
        ips.size shouldBe 5
        ips.toSet().size shouldBe 5 // all unique
        ips[0] shouldStartWith "10.66.66."
    }
}
