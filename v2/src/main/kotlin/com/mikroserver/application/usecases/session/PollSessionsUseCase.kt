package com.mikroserver.application.usecases.session

import com.mikroserver.domain.entities.HotspotSession
import com.mikroserver.domain.entities.Router
import com.mikroserver.domain.entities.RouterStatus
import com.mikroserver.domain.events.DomainEvent
import com.mikroserver.domain.repositories.OutboxRepository
import com.mikroserver.domain.repositories.RouterRepository
import com.mikroserver.domain.repositories.SessionRepository
import com.mikroserver.infrastructure.resilience.RouterCircuitBreakerRegistry
import com.mikroserver.infrastructure.routeros.RouterOsClient
import com.mikroserver.infrastructure.wireguard.WireGuardController
import com.mikroserver.shared.AppConfig
import io.github.resilience4j.circuitbreaker.CallNotPermittedException
import kotlinx.coroutines.*
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * Scheduled coroutine: polls each ONLINE router every 60s via RouterOS API
 * to get active hotspot sessions and update the database.
 * Also checks WireGuard handshake age to detect OFFLINE routers.
 */
class PollSessionsUseCase(
    private val routerRepository: RouterRepository,
    private val sessionRepository: SessionRepository,
    private val outboxRepository: OutboxRepository,
    private val routerOsClient: RouterOsClient,
    private val wireGuardController: WireGuardController,
    private val circuitBreakerRegistry: RouterCircuitBreakerRegistry,
    private val config: AppConfig,
) {
    private val log = LoggerFactory.getLogger(PollSessionsUseCase::class.java)

    companion object {
        private const val POLL_INTERVAL_MS = 60_000L
        private const val HANDSHAKE_STALE_SECONDS = 180L // 3 minutes without handshake = OFFLINE
    }

    /** Start the polling loop in the given scope. */
    fun start(scope: CoroutineScope): Job = scope.launch {
        log.info("Session poller started")
        while (isActive) {
            try {
                pollAllRouters()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                log.error("Session poller error: {}", e.message, e)
            }
            delay(POLL_INTERVAL_MS)
        }
    }

    private suspend fun pollAllRouters() {
        val routers = routerRepository.findOnlineRouters()
        log.debug("Polling {} routers", routers.size)

        coroutineScope {
            routers.map { router ->
                launch {
                    pollRouter(router)
                }
            }
        }
    }

    private suspend fun pollRouter(router: Router) {
        // Check WireGuard handshake freshness
        val handshakeResult = wireGuardController.getLastHandshake(
            config.wireguard.interfaceName,
            router.wgPublicKey,
        )
        val handshakeEpoch = handshakeResult.getOrNull() ?: 0L
        val now = Clock.System.now()

        val newStatus = if (handshakeEpoch == 0L ||
            (now.epochSeconds - handshakeEpoch) > HANDSHAKE_STALE_SECONDS
        ) {
            RouterStatus.OFFLINE
        } else {
            RouterStatus.ONLINE
        }

        if (newStatus != router.status) {
            routerRepository.update(router.copy(status = newStatus, lastHandshakeAt = Instant.fromEpochSeconds(handshakeEpoch)))
            outboxRepository.save(
                DomainEvent.RouterStatusChanged(
                    aggregateId = router.id,
                    oldStatus = router.status.name,
                    newStatus = newStatus.name,
                ),
            )
            log.info("Router {} status changed: {} → {}", router.name, router.status, newStatus)
        }

        if (newStatus == RouterStatus.OFFLINE) return

        // Fetch active sessions from RouterOS
        val cb = circuitBreakerRegistry.forRouter(router.id)
        val sessionsResult = try {
            cb.executeCallable {
                kotlinx.coroutines.runBlocking {
                    routerOsClient.getActiveHotspotSessions(
                        host = router.wgAllowedIp,
                        port = router.apiPort,
                        username = router.apiUsername,
                        password = "",
                    )
                }
            }
        } catch (e: CallNotPermittedException) {
            log.warn("Circuit breaker OPEN for router {} during poll", router.id)
            return
        }

        val sessions = sessionsResult.getOrNull() ?: return

        val activeMacs = mutableSetOf<String>()
        for (session in sessions) {
            activeMacs.add(session.macAddress)
            sessionRepository.upsertByMacAndRouter(
                HotspotSession(
                    id = UUID.randomUUID(),
                    routerId = router.id,
                    voucherId = null,
                    macAddress = session.macAddress,
                    ipAddress = session.ipAddress,
                    bytesIn = session.bytesIn,
                    bytesOut = session.bytesOut,
                    uptimeSecs = parseUptimeToSeconds(session.uptime),
                    isActive = true,
                    startedAt = now,
                    endedAt = null,
                    createdAt = now,
                    updatedAt = now,
                ),
            )
        }

        // Mark sessions as inactive if no longer in RouterOS active list
        sessionRepository.deactivateStale(router.id, activeMacs)
    }

    /** Parse MikroTik uptime format (e.g. "1h23m45s", "5m30s") to seconds. */
    private fun parseUptimeToSeconds(uptime: String): Int {
        var total = 0
        var current = ""
        for (c in uptime) {
            when (c) {
                'd' -> { total += (current.toIntOrNull() ?: 0) * 86400; current = "" }
                'h' -> { total += (current.toIntOrNull() ?: 0) * 3600; current = "" }
                'm' -> { total += (current.toIntOrNull() ?: 0) * 60; current = "" }
                's' -> { total += (current.toIntOrNull() ?: 0); current = "" }
                else -> current += c
            }
        }
        return total
    }
}
