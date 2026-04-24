package com.mikroserver.application.usecases.voucher

import com.mikroserver.domain.entities.Voucher
import com.mikroserver.domain.entities.VoucherStatus
import com.mikroserver.domain.events.DomainEvent
import com.mikroserver.domain.repositories.*
import com.mikroserver.infrastructure.resilience.RouterCircuitBreakerRegistry
import com.mikroserver.infrastructure.routeros.RouterOsClient
import com.mikroserver.shared.AppError
import com.mikroserver.shared.AppResult
import com.mikroserver.shared.generateHotspotPassword
import com.mikroserver.shared.generateVoucherCode
import io.github.resilience4j.circuitbreaker.CallNotPermittedException
import kotlinx.datetime.Clock
import org.slf4j.LoggerFactory
import java.util.UUID
import kotlin.time.Duration.Companion.minutes

/**
 * Generate a voucher for a paid transaction.
 * Idempotent: if a voucher already exists for the transaction, return it.
 * Calls RouterOS to add the hotspot user, wrapped in a per-router circuit breaker.
 */
class GenerateVoucherUseCase(
    private val voucherRepository: VoucherRepository,
    private val transactionRepository: TransactionRepository,
    private val planRepository: PlanRepository,
    private val routerRepository: RouterRepository,
    private val outboxRepository: OutboxRepository,
    private val routerOsClient: RouterOsClient,
    private val circuitBreakerRegistry: RouterCircuitBreakerRegistry,
) {
    private val log = LoggerFactory.getLogger(GenerateVoucherUseCase::class.java)

    data class Command(
        val transactionId: UUID,
        val operatorId: UUID,
        val planId: UUID,
        val routerId: UUID,
    )

    suspend fun execute(command: Command): AppResult<Voucher> {
        // Idempotency check
        val existing = voucherRepository.findByTransactionId(command.transactionId)
        if (existing != null) {
            log.info("Voucher already exists for transaction {}", command.transactionId)
            return AppResult.ok(existing)
        }

        val plan = planRepository.findById(command.planId)
            ?: return AppResult.err(AppError.NotFound("Plan", command.planId.toString()))

        val router = routerRepository.findById(command.routerId)
            ?: return AppResult.err(AppError.NotFound("Router", command.routerId.toString()))

        val now = Clock.System.now()
        val voucherCode = generateVoucherCode()
        val hotspotUsername = "v-$voucherCode"
        val hotspotPassword = generateHotspotPassword()

        // Create voucher in PENDING state
        val voucher = Voucher(
            id = UUID.randomUUID(),
            operatorId = command.operatorId,
            transactionId = command.transactionId,
            planId = command.planId,
            routerId = command.routerId,
            code = voucherCode,
            hotspotUsername = hotspotUsername,
            hotspotPassword = hotspotPassword,
            status = VoucherStatus.PENDING,
            activatedAt = null,
            expiresAt = null,
            createdAt = now,
            updatedAt = now,
        )
        voucherRepository.create(voucher)

        // Add hotspot user via RouterOS API, wrapped in circuit breaker
        val cb = circuitBreakerRegistry.forRouter(command.routerId)
        val routerResult = try {
            cb.executeCallable {
                kotlinx.coroutines.runBlocking {
                    routerOsClient.addHotspotUser(
                        host = router.wgAllowedIp,
                        port = router.apiPort,
                        username = router.apiUsername,
                        password = "", // encrypted password would be decrypted here
                        routerUser = router.apiUsername,
                        routerPass = "",
                        hotspotUsername = hotspotUsername,
                        hotspotPassword = hotspotPassword,
                        rateLimit = plan.bandwidthLimit,
                        uptimeLimit = "${plan.durationMinutes}m",
                    )
                }
            }
        } catch (e: CallNotPermittedException) {
            log.warn("Circuit breaker OPEN for router {}", command.routerId)
            AppResult.err(AppError.ExternalServiceError("RouterOS", "Circuit breaker open for router ${router.name}"))
        }

        if (routerResult.isErr) {
            return routerResult.map { voucher }
        }

        // Activate voucher
        val activatedVoucher = voucher.copy(
            status = VoucherStatus.ACTIVE,
            activatedAt = Clock.System.now(),
            expiresAt = Clock.System.now() + plan.durationMinutes.minutes,
        )
        voucherRepository.update(activatedVoucher)

        outboxRepository.save(
            DomainEvent.VoucherActivated(
                aggregateId = activatedVoucher.id,
                transactionId = command.transactionId,
                routerId = command.routerId,
                code = voucherCode,
            ),
        )

        log.info("Voucher {} activated on router {}", voucherCode, router.name)
        return AppResult.ok(activatedVoucher)
    }
}
