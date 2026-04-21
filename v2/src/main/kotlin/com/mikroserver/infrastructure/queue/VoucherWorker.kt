package com.mikroserver.infrastructure.queue

import com.mikroserver.application.usecases.voucher.GenerateVoucherUseCase
import kotlinx.coroutines.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import java.util.UUID

/** Payload shape for the voucher generation job. */
@Serializable
data class GenerateVoucherJobPayload(
    val transactionId: String,
    val operatorId: String,
    val planId: String,
    val routerId: String,
    val amountXof: Int,
    val phoneNumber: String,
)

/**
 * Background worker that processes voucher generation jobs from the Redis queue.
 * Uses structured concurrency for clean shutdown.
 */
class VoucherWorker(
    private val queue: RedisJobQueue,
    private val generateVoucherUseCase: GenerateVoucherUseCase,
    private val json: Json,
) {
    private val log = LoggerFactory.getLogger(VoucherWorker::class.java)

    companion object {
        const val JOB_TYPE = "generate-voucher"
    }

    /** Start the worker loop in the given [scope]. */
    fun start(scope: CoroutineScope): Job = scope.launch {
        log.info("VoucherWorker started")
        while (isActive) {
            try {
                val job = queue.dequeue(JOB_TYPE) ?: continue
                processJob(job)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                log.error("VoucherWorker unexpected error: {}", e.message, e)
                delay(1000)
            }
        }
        log.info("VoucherWorker stopped")
    }

    private suspend fun processJob(job: RedisJobQueue.Job) {
        log.info("Processing job {} attempt={}", job.id, job.attempts)
        try {
            val payload = json.decodeFromString(GenerateVoucherJobPayload.serializer(), job.payload)
            val result = generateVoucherUseCase.execute(
                GenerateVoucherUseCase.Command(
                    transactionId = UUID.fromString(payload.transactionId),
                    operatorId = UUID.fromString(payload.operatorId),
                    planId = UUID.fromString(payload.planId),
                    routerId = UUID.fromString(payload.routerId),
                ),
            )
            result.onSuccess {
                log.info("Voucher {} generated for transaction {}", it.code, payload.transactionId)
            }.onFailure { error ->
                log.error("Voucher generation failed for {}: {}", payload.transactionId, error.message)
                queue.retry(job)
            }
        } catch (e: Exception) {
            log.error("Job {} deserialization/processing error: {}", job.id, e.message)
            queue.retry(job)
        }
    }
}
