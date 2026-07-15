package com.mikroserver.application.usecases.router

import com.mikroserver.domain.entities.Router
import com.mikroserver.domain.entities.RouterStatus
import com.mikroserver.domain.events.DomainEvent
import com.mikroserver.domain.repositories.OutboxRepository
import com.mikroserver.domain.repositories.RouterRepository
import com.mikroserver.infrastructure.allocation.IpAllocator
import com.mikroserver.infrastructure.allocation.PortAllocator
import com.mikroserver.infrastructure.persistence.TransactionRunner
import com.mikroserver.infrastructure.routeros.ProvisioningContext
import com.mikroserver.infrastructure.routeros.RouterOsScriptBuilder
import com.mikroserver.infrastructure.security.RouterTokenService
import com.mikroserver.infrastructure.wireguard.WgPeerManager
import com.mikroserver.infrastructure.wireguard.WireGuardKeyGenerator
import com.mikroserver.shared.AppConfig
import com.mikroserver.shared.AppError
import com.mikroserver.shared.AppException
import com.mikroserver.shared.AppResult
import kotlinx.datetime.Clock
import org.slf4j.LoggerFactory
import java.util.UUID

/** What the mobile app receives once — [provisioningScript] carries the ephemeral private key. */
data class ProvisioningResult(
    val routerId: UUID,
    val provisioningScript: String,
    val expectedIp: String,
    val dnatPortBase: Int,
    val publicManagementUrl: String,
)

/**
 * Orchestrates router onboarding, MikroTicket-style. The WireGuard private key is
 * generated here, injected once into the returned script, and never persisted nor
 * logged — only the public key is stored.
 */
class ProvisioningService(
    private val transactionRunner: TransactionRunner,
    private val routerRepository: RouterRepository,
    private val outboxRepository: OutboxRepository,
    private val ipAllocator: IpAllocator,
    private val portAllocator: PortAllocator,
    private val keyGenerator: WireGuardKeyGenerator,
    private val wgPeerManager: WgPeerManager,
    private val scriptBuilder: RouterOsScriptBuilder,
    private val tokenService: RouterTokenService,
    private val config: AppConfig,
) {
    private val log = LoggerFactory.getLogger(ProvisioningService::class.java)

    suspend fun provision(operatorId: UUID, name: String): AppResult<ProvisioningResult> {
        val routerId = UUID.randomUUID()
        val keyPair = keyGenerator.generate()
        val now = Clock.System.now()

        // Reserve IP + port and insert the row atomically (advisory lock held until commit).
        val router = runCatching {
            transactionRunner.inTransaction {
                val ip = ipAllocator.allocate().getOrThrow()
                val portBase = portAllocator.allocate().getOrThrow()
                val row = Router(
                    id = routerId,
                    operatorId = operatorId,
                    name = name,
                    macAddress = null,
                    wgPublicKey = keyPair.publicKey,
                    wgAllowedIp = ip,
                    wgEndpoint = null,
                    dnatPortBase = portBase,
                    apiPort = ROUTEROS_API_PORT,
                    apiUsername = "admin",
                    apiPasswordEnc = null,
                    status = RouterStatus.PROVISIONING,
                    lastHandshakeAt = null,
                    provisionedAt = now,
                    createdAt = now,
                    updatedAt = now,
                )
                routerRepository.create(row)
                row
            }
        }.getOrElse { e ->
            return when (e) {
                is AppException -> AppResult.err(e.error)
                else -> AppResult.err(AppError.Conflict("Router", e.message ?: "allocation failed"))
            }
        }

        // External side effect: add the WG peer. Compensate (free the slot) on failure.
        val added = wgPeerManager.addPeer(routerId, keyPair.publicKey, router.wgAllowedIp)
        if (added.isErr) {
            log.error("addPeer failed for router {}, rolling back reservation", routerId)
            runCatching {
                transactionRunner.inTransaction {
                    routerRepository.update(router.copy(status = RouterStatus.REVOKED, deletedAt = now, updatedAt = now))
                }
            }
            return AppResult.err(added.errorOrNull()!!)
        }

        outboxRepository.save(DomainEvent.RouterOnboarded(routerId, operatorId, router.wgAllowedIp))
        log.info("Router provisioned: id={} ip={} portBase={}", routerId, router.wgAllowedIp, router.dnatPortBase)
        return AppResult.ok(buildResult(routerId, keyPair.privateKey, keyPair.publicKey, router.wgAllowedIp, router.dnatPortBase))
    }

    suspend fun reprovision(routerId: UUID, operatorId: UUID): AppResult<ProvisioningResult> {
        val router = ownedRouter(routerId, operatorId).getOrElse { return AppResult.err(it) }
        val now = Clock.System.now()

        // Drop the old peer (best effort — a stale/missing peer must not block reprovision).
        wgPeerManager.removePeer(routerId, router.wgPublicKey)

        val keyPair = keyGenerator.generate()
        val updated = router.copy(
            wgPublicKey = keyPair.publicKey,
            status = RouterStatus.PROVISIONING,
            provisionedAt = now,
            updatedAt = now,
        )
        runCatching { transactionRunner.inTransaction { routerRepository.update(updated) } }
            .getOrElse { return AppResult.err(AppError.InfrastructureError(it.message ?: "update failed")) }

        val added = wgPeerManager.addPeer(routerId, keyPair.publicKey, router.wgAllowedIp)
        if (added.isErr) return AppResult.err(added.errorOrNull()!!)

        outboxRepository.save(DomainEvent.RouterStatusChanged(routerId, router.status.name, RouterStatus.PROVISIONING.name))
        return AppResult.ok(buildResult(routerId, keyPair.privateKey, keyPair.publicKey, router.wgAllowedIp, router.dnatPortBase))
    }

    suspend fun revoke(routerId: UUID, operatorId: UUID): AppResult<Unit> {
        val router = ownedRouter(routerId, operatorId).getOrElse { return AppResult.err(it) }
        val now = Clock.System.now()

        wgPeerManager.removePeer(routerId, router.wgPublicKey)
        runCatching {
            transactionRunner.inTransaction {
                routerRepository.update(router.copy(status = RouterStatus.REVOKED, deletedAt = now, updatedAt = now))
            }
        }.getOrElse { return AppResult.err(AppError.InfrastructureError(it.message ?: "revoke failed")) }

        outboxRepository.save(DomainEvent.RouterStatusChanged(routerId, router.status.name, RouterStatus.REVOKED.name))
        return AppResult.ok(Unit)
    }

    suspend fun status(routerId: UUID, operatorId: UUID): AppResult<Router> =
        ownedRouter(routerId, operatorId)

    /** Router-authenticated liveness ping (token derived from the stored public key). */
    suspend fun recordHeartbeat(routerId: UUID, token: String): AppResult<Unit> {
        val router = routerRepository.findById(routerId)
            ?: return AppResult.err(AppError.NotFound("Router", routerId.toString()))
        if (!tokenService.verify(router.wgPublicKey, token)) {
            return AppResult.err(AppError.Unauthorized("Invalid router token"))
        }
        val now = Clock.System.now()
        val newStatus = if (router.status == RouterStatus.PROVISIONING || router.status == RouterStatus.OFFLINE) {
            RouterStatus.ACTIVE
        } else {
            router.status
        }
        runCatching {
            transactionRunner.inTransaction {
                routerRepository.update(router.copy(status = newStatus, lastHandshakeAt = now, updatedAt = now))
            }
        }.getOrElse { return AppResult.err(AppError.InfrastructureError(it.message ?: "heartbeat failed")) }
        return AppResult.ok(Unit)
    }

    private inline fun <T> AppResult<T>.getOrElse(onErr: (AppError) -> T): T = when (this) {
        is AppResult.Ok -> value
        is AppResult.Err -> onErr(error)
    }

    private suspend fun ownedRouter(routerId: UUID, operatorId: UUID): AppResult<Router> {
        val router = routerRepository.findById(routerId)
            ?: return AppResult.err(AppError.NotFound("Router", routerId.toString()))
        if (router.operatorId != operatorId) {
            return AppResult.err(AppError.Forbidden("Router belongs to another operator"))
        }
        return AppResult.ok(router)
    }

    private fun buildResult(
        routerId: UUID,
        privateKey: String,
        publicKey: String,
        ip: String,
        dnatPortBase: Int,
    ): ProvisioningResult {
        val host = config.wireguard.serverEndpoint.substringBefore(":")
        val ctx = ProvisioningContext(
            routerId = routerId,
            wgServerPublicKey = config.wireguard.serverPublicKey.orEmpty(),
            wgClientPrivateKey = privateKey,
            wgClientIp = ip,
            serverEndpointHost = host,
            serverPort = config.wireguard.serverPort,
            heartbeatUrl = "https://$host/v1/routers/$routerId/heartbeat",
            heartbeatToken = tokenService.tokenFor(publicKey),
        )
        return ProvisioningResult(
            routerId = routerId,
            provisioningScript = scriptBuilder.build(ctx),
            expectedIp = ip,
            dnatPortBase = dnatPortBase,
            publicManagementUrl = "http://$host:$dnatPortBase",
        )
    }

    private companion object {
        const val ROUTEROS_API_PORT = 8728
    }
}
