package com.mikroserver.application.usecases.router

import com.mikroserver.domain.entities.Router
import com.mikroserver.domain.entities.RouterStatus
import com.mikroserver.domain.events.DomainEvent
import com.mikroserver.domain.repositories.OutboxEvent
import com.mikroserver.domain.repositories.OutboxRepository
import com.mikroserver.domain.repositories.RouterRepository
import com.mikroserver.infrastructure.wireguard.InMemoryWgPeerManager
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.test.runTest
import kotlinx.datetime.Clock
import org.junit.jupiter.api.Test
import java.util.UUID

class HandshakePollerTest {

    private val now = 1_700_000_000L

    // ── Pure transition ────────────────────────────────────────────────────────

    @Test
    fun `fresh handshake activates a provisioning router`() {
        HandshakeStatus.next(RouterStatus.PROVISIONING, now - 10, now) shouldBe RouterStatus.ACTIVE
    }

    @Test
    fun `stale handshake takes an active router offline`() {
        HandshakeStatus.next(RouterStatus.ACTIVE, now - 400, now) shouldBe RouterStatus.OFFLINE
    }

    @Test
    fun `fresh handshake brings an offline router back`() {
        HandshakeStatus.next(RouterStatus.OFFLINE, now - 5, now) shouldBe RouterStatus.ACTIVE
    }

    @Test
    fun `provisioning without a handshake stays provisioning`() {
        HandshakeStatus.next(RouterStatus.PROVISIONING, 0, now) shouldBe RouterStatus.PROVISIONING
    }

    @Test
    fun `revoked is never resurrected`() {
        HandshakeStatus.next(RouterStatus.REVOKED, now, now) shouldBe RouterStatus.REVOKED
    }

    // ── pollOnce ───────────────────────────────────────────────────────────────

    @Test
    fun `pollOnce flips a provisioning router to active on handshake`() = runTest {
        val router = router(RouterStatus.PROVISIONING, "PUBKEY=")
        val repo = FakeRepo(mutableListOf(router))
        val wg = InMemoryWgPeerManager().apply {
            peers[router.id] = "PUBKEY=" to router.wgAllowedIp
            handshakes["PUBKEY="] = Clock.System.now().epochSeconds
        }
        val outbox = RecordingOutbox()

        HandshakePoller(repo, wg, outbox).pollOnce()

        repo.byId.getValue(router.id).status shouldBe RouterStatus.ACTIVE
        outbox.events.filterIsInstance<DomainEvent.RouterStatusChanged>().single().newStatus shouldBe "ACTIVE"
    }

    private fun router(status: RouterStatus, pub: String): Router {
        val t = Clock.System.now()
        return Router(
            id = UUID.randomUUID(), operatorId = UUID.randomUUID(), name = "R", macAddress = null,
            wgPublicKey = pub, wgAllowedIp = "10.66.66.10", wgEndpoint = null, dnatPortBase = 19000,
            apiPort = 8728, apiUsername = "admin", apiPasswordEnc = null, status = status,
            lastHandshakeAt = null, provisionedAt = t, createdAt = t, updatedAt = t,
        )
    }

    private class FakeRepo(routers: MutableList<Router>) : RouterRepository {
        val byId = routers.associateBy { it.id }.toMutableMap()
        override suspend fun findManaged(): List<Router> =
            byId.values.filter { it.status != RouterStatus.REVOKED && it.deletedAt == null }
        override suspend fun update(router: Router): Router { byId[router.id] = router; return router }
        override suspend fun findById(id: UUID): Router? = byId[id]
        override suspend fun findByOperatorId(operatorId: UUID): List<Router> = emptyList()
        override suspend fun findOnlineRouters(): List<Router> = emptyList()
        override suspend fun findMaxWgIp(): String? = null
        override suspend fun findMaxDnatPortBase(): Int? = null
        override suspend fun create(router: Router): Router = router
    }

    private class RecordingOutbox : OutboxRepository {
        val events = mutableListOf<DomainEvent>()
        override suspend fun save(event: DomainEvent) { events.add(event) }
        override suspend fun findUnpublished(limit: Int): List<OutboxEvent> = emptyList()
        override suspend fun markPublished(ids: List<UUID>) {}
    }
}
