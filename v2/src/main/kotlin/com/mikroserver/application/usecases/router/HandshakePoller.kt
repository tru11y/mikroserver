package com.mikroserver.application.usecases.router

import com.mikroserver.domain.entities.RouterStatus
import com.mikroserver.domain.events.DomainEvent
import com.mikroserver.domain.repositories.OutboxRepository
import com.mikroserver.domain.repositories.RouterRepository
import com.mikroserver.infrastructure.wireguard.WgPeerManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import org.slf4j.LoggerFactory

/** Pure status transition from a peer's latest handshake age. */
object HandshakeStatus {

    const val STALE_SECONDS = 300L // 5 minutes without a handshake => OFFLINE

    fun next(current: RouterStatus, handshakeEpoch: Long, nowEpoch: Long, staleSeconds: Long = STALE_SECONDS): RouterStatus {
        if (current == RouterStatus.REVOKED) return current
        val recent = handshakeEpoch > 0 && (nowEpoch - handshakeEpoch) <= staleSeconds
        return when {
            recent -> RouterStatus.ACTIVE // PROVISIONING/OFFLINE/ACTIVE all converge to ACTIVE on a fresh handshake
            current == RouterStatus.ACTIVE -> RouterStatus.OFFLINE
            else -> current // PROVISIONING waits for its first handshake; OFFLINE stays OFFLINE
        }
    }
}

/**
 * Background coroutine that reconciles router status from WireGuard handshakes.
 * Authoritative for the PROVISIONING/ACTIVE/OFFLINE transitions.
 */
class HandshakePoller(
    private val routerRepository: RouterRepository,
    private val wgPeerManager: WgPeerManager,
    private val outboxRepository: OutboxRepository,
) {
    private val log = LoggerFactory.getLogger(HandshakePoller::class.java)

    fun start(scope: CoroutineScope): Job = scope.launch {
        log.info("Handshake poller started")
        while (isActive) {
            try {
                pollOnce()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                log.error("Handshake poller error: {}", e.message, e)
            }
            delay(POLL_INTERVAL_MS)
        }
    }

    suspend fun pollOnce() {
        val handshakes = wgPeerManager.listPeersWithHandshake().getOrNull() ?: return
        val epochByKey = handshakes.associate { it.publicKey to it.latestHandshakeEpoch }
        val now = Clock.System.now()
        val nowEpoch = now.epochSeconds

        for (router in routerRepository.findManaged()) {
            val epoch = epochByKey[router.wgPublicKey] ?: 0L
            val next = HandshakeStatus.next(router.status, epoch, nowEpoch)
            val newHandshakeAt = if (epoch > 0) Instant.fromEpochSeconds(epoch) else router.lastHandshakeAt
            if (next == router.status && newHandshakeAt == router.lastHandshakeAt) continue

            routerRepository.update(router.copy(status = next, lastHandshakeAt = newHandshakeAt, updatedAt = now))
            if (next != router.status) {
                outboxRepository.save(DomainEvent.RouterStatusChanged(router.id, router.status.name, next.name))
                log.info("Router {} status {} -> {}", router.id, router.status, next)
            }
        }
    }

    private companion object {
        const val POLL_INTERVAL_MS = 30_000L
    }
}
