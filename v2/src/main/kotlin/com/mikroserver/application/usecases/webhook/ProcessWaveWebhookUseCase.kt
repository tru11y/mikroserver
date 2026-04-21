package com.mikroserver.application.usecases.webhook

import com.mikroserver.domain.entities.Transaction
import com.mikroserver.domain.entities.TransactionStatus
import com.mikroserver.domain.events.DomainEvent
import com.mikroserver.domain.repositories.OutboxRepository
import com.mikroserver.domain.repositories.PlanRepository
import com.mikroserver.domain.repositories.TransactionRepository
import com.mikroserver.infrastructure.queue.GenerateVoucherJobPayload
import com.mikroserver.infrastructure.queue.RedisJobQueue
import com.mikroserver.infrastructure.queue.VoucherWorker
import com.mikroserver.infrastructure.wave.WaveWebhookPayload
import com.mikroserver.infrastructure.wave.WaveWebhookVerifier
import com.mikroserver.shared.AppError
import com.mikroserver.shared.AppResult
import kotlinx.datetime.Clock
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * Process incoming Wave webhook: verify HMAC, store transaction, enqueue voucher generation.
 * Must respond in <3s (store-and-queue pattern).
 */
class ProcessWaveWebhookUseCase(
    private val webhookVerifier: WaveWebhookVerifier,
    private val transactionRepository: TransactionRepository,
    private val planRepository: PlanRepository,
    private val outboxRepository: OutboxRepository,
    private val jobQueue: RedisJobQueue,
    private val json: Json,
) {
    private val log = LoggerFactory.getLogger(ProcessWaveWebhookUseCase::class.java)

    data class Command(
        val rawBody: ByteArray,
        val signature: String,
        val operatorId: UUID,
        val routerId: UUID,
    )

    suspend fun execute(command: Command): AppResult<Transaction> {
        // Verify HMAC signature
        val parseResult = webhookVerifier.verifyAndParse(command.rawBody, command.signature)
        if (parseResult.isErr) return parseResult.map { throw IllegalStateException() }

        val payload = parseResult.getOrThrow()

        // Idempotent: check if transaction already exists
        val existing = transactionRepository.findByWaveTransactionId(payload.id)
        if (existing != null) {
            log.info("Duplicate webhook for wave_txn={}, returning existing", payload.id)
            return AppResult.ok(existing)
        }

        val amountXof = payload.amount.toIntOrNull()
            ?: return AppResult.err(AppError.ValidationError("amount", "Not a valid integer"))

        // Find matching plan by price
        val plan = planRepository.findByPriceAndOperator(amountXof, command.operatorId)
            ?: return AppResult.err(AppError.NotFound("Plan", "price=$amountXof"))

        val now = Clock.System.now()
        val idempotencyKey = "wave-${payload.id}"
        val status = if (payload.status == "succeeded") TransactionStatus.PAID else TransactionStatus.PENDING

        val transaction = Transaction(
            id = UUID.randomUUID(),
            operatorId = command.operatorId,
            waveTransactionId = payload.id,
            amountXof = amountXof,
            status = status,
            phoneNumber = payload.phoneNumber.orEmpty(),
            planId = plan.id,
            routerId = command.routerId,
            idempotencyKey = idempotencyKey,
            rawWebhookPayload = String(command.rawBody, Charsets.UTF_8),
            webhookReceivedAt = now,
            createdAt = now,
            updatedAt = now,
        )
        transactionRepository.create(transaction)

        if (status == TransactionStatus.PAID) {
            outboxRepository.save(
                DomainEvent.TransactionPaid(
                    aggregateId = transaction.id,
                    waveTransactionId = payload.id,
                    amountXof = amountXof,
                ),
            )

            // Enqueue voucher generation job (idempotent job ID)
            val jobPayload = json.encodeToString(
                GenerateVoucherJobPayload(
                    transactionId = transaction.id.toString(),
                    operatorId = command.operatorId.toString(),
                    planId = plan.id.toString(),
                    routerId = command.routerId.toString(),
                    amountXof = amountXof,
                    phoneNumber = transaction.phoneNumber,
                ),
            )
            jobQueue.enqueue(
                type = VoucherWorker.JOB_TYPE,
                payload = jobPayload,
                jobId = "voucher-${transaction.id}",
            )
            log.info("Transaction {} PAID, voucher job enqueued", transaction.id)
        }

        return AppResult.ok(transaction)
    }
}
