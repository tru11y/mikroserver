package com.mikroserver.application.usecases.router

import com.mikroserver.domain.entities.Router
import com.mikroserver.domain.entities.RouterStatus
import com.mikroserver.domain.events.DomainEvent
import com.mikroserver.domain.repositories.OutboxRepository
import com.mikroserver.domain.repositories.RouterRepository
import com.mikroserver.domain.values.WgProvision
import com.mikroserver.infrastructure.wireguard.CryptoKeyGenerator
import com.mikroserver.infrastructure.wireguard.WireGuardController
import com.mikroserver.shared.AppConfig
import com.mikroserver.shared.AppError
import com.mikroserver.shared.AppResult
import kotlinx.datetime.Clock
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * Onboard a new router: generate WG keypair, assign next free 10.66.66.x/32,
 * add peer to host wg0, persist, return provisioning data.
 */
class OnboardRouterUseCase(
    private val routerRepository: RouterRepository,
    private val outboxRepository: OutboxRepository,
    private val wireGuardController: WireGuardController,
    private val config: AppConfig,
) {
    private val log = LoggerFactory.getLogger(OnboardRouterUseCase::class.java)

    data class Command(
        val operatorId: UUID,
        val name: String,
        val macAddress: String?,
    )

    data class Result(
        val router: Router,
        val wgProvision: WgProvision,
    )

    suspend fun execute(command: Command): AppResult<Result> {
        // Generate X25519 keypair
        val keyPair = CryptoKeyGenerator.generateX25519KeyPair()

        // Assign next free WG IP (concurrency-safe via UNIQUE constraint on wg_allowed_ip)
        val nextIp = allocateNextIp()
            ?: return AppResult.err(AppError.InfrastructureError("WireGuard subnet exhausted"))

        val now = Clock.System.now()
        val routerId = UUID.randomUUID()

        val router = Router(
            id = routerId,
            operatorId = command.operatorId,
            name = command.name,
            macAddress = command.macAddress,
            wgPublicKey = keyPair.publicKey,
            wgAllowedIp = nextIp,
            wgEndpoint = null,
            apiPort = 8728,
            apiUsername = "admin",
            apiPasswordEnc = null,
            status = RouterStatus.OFFLINE,
            lastHandshakeAt = null,
            createdAt = now,
            updatedAt = now,
        )

        // Persist first (so the UNIQUE constraint catches races)
        try {
            routerRepository.create(router)
        } catch (e: Exception) {
            log.error("Router creation failed (IP collision?): {}", e.message)
            return AppResult.err(AppError.Conflict("Router", "WG IP $nextIp already assigned"))
        }

        // Add peer to host WireGuard interface
        val addResult = wireGuardController.addPeer(
            interfaceName = config.wireguard.interfaceName,
            publicKey = keyPair.publicKey,
            allowedIp = nextIp,
        )
        if (addResult.isErr) {
            log.error("WG addPeer failed for router {}, rolling back", routerId)
            // Soft-delete the router row since WG peer wasn't added
            routerRepository.update(router.copy(deletedAt = now))
            return addResult.map { }
        }

        // Persist WG config to survive reboots
        wireGuardController.saveConfig(config.wireguard.interfaceName)

        // Emit domain event
        outboxRepository.save(
            DomainEvent.RouterOnboarded(
                aggregateId = routerId,
                operatorId = command.operatorId,
                wgAllowedIp = nextIp,
            ),
        )

        log.info("Router onboarded: id={} wgIp={}", routerId, nextIp)

        return AppResult.ok(
            Result(
                router = router,
                wgProvision = WgProvision(
                    privateKey = keyPair.privateKey,
                    publicKey = keyPair.publicKey,
                    wgIp = nextIp,
                    vpsPublicKey = config.wireguard.serverPublicKey.orEmpty(),
                    vpsEndpoint = config.wireguard.serverEndpoint,
                ),
            ),
        )
    }

    /**
     * Allocate the next free IP in the 10.66.66.x/24 subnet.
     * Server is .1, routers start at .2.
     */
    private suspend fun allocateNextIp(): String? {
        val maxIp = routerRepository.findMaxWgIp()
        val lastOctet = if (maxIp != null) {
            val parts = maxIp.split(".")
            parts.lastOrNull()?.split("/")?.firstOrNull()?.toIntOrNull() ?: 1
        } else {
            1 // no routers yet, start from .2
        }
        val nextOctet = lastOctet + 1
        if (nextOctet > 254) return null
        return "10.66.66.$nextOctet"
    }
}
