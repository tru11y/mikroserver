package com.mikroserver.infrastructure.queue

import io.lettuce.core.RedisClient
import io.lettuce.core.api.coroutines
import io.lettuce.core.api.coroutines.RedisCoroutinesCommands
import kotlinx.coroutines.*
import kotlinx.datetime.Clock
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * Minimal BullMQ-equivalent job queue backed by Redis (Lettuce).
 * Supports delayed jobs, retries with exponential backoff, and DLQ.
 */
class RedisJobQueue(
    redisUrl: String,
    private val json: Json,
) {
    private val log = LoggerFactory.getLogger(RedisJobQueue::class.java)
    private val client = RedisClient.create(redisUrl)
    private val connection = client.connect()
    private val redis: RedisCoroutinesCommands<String, String> = connection.coroutines()

    companion object {
        private const val QUEUE_PREFIX = "mks:queue"
        private const val DELAYED_KEY = "$QUEUE_PREFIX:delayed"
        private const val DLQ_KEY = "$QUEUE_PREFIX:dlq"
        private const val MAX_RETRIES = 5
        private const val BASE_BACKOFF_MS = 1000L
    }

    @Serializable
    data class Job(
        val id: String = UUID.randomUUID().toString(),
        val type: String,
        val payload: String,
        val attempts: Int = 0,
        val maxRetries: Int = MAX_RETRIES,
        val createdAt: Long = Clock.System.now().toEpochMilliseconds(),
    )

    /** Enqueue a job for immediate processing. */
    suspend fun enqueue(type: String, payload: String, jobId: String? = null): String {
        val job = Job(
            id = jobId ?: UUID.randomUUID().toString(),
            type = type,
            payload = payload,
        )
        val serialized = json.encodeToString(job)
        redis.rpush(queueKey(type), serialized)
        log.debug("Enqueued job {} type={}", job.id, type)
        return job.id
    }

    /** Enqueue a job with a delay (in milliseconds). */
    suspend fun enqueueDelayed(type: String, payload: String, delayMs: Long, jobId: String? = null): String {
        val job = Job(
            id = jobId ?: UUID.randomUUID().toString(),
            type = type,
            payload = payload,
        )
        val processAt = Clock.System.now().toEpochMilliseconds() + delayMs
        val serialized = json.encodeToString(job)
        redis.zadd(DELAYED_KEY, processAt.toDouble(), serialized)
        log.debug("Enqueued delayed job {} type={} processAt={}", job.id, type, processAt)
        return job.id
    }

    /** Dequeue a job from the given queue (blocking with timeout). Returns null if no job available. */
    suspend fun dequeue(type: String, timeoutSeconds: Long = 5): Job? {
        val result = redis.blpop(timeoutSeconds, queueKey(type))
        if (result == null || result.value == null) return null
        return json.decodeFromString(Job.serializer(), result.value)
    }

    /** Re-enqueue a failed job with exponential backoff, or send to DLQ if max retries exceeded. */
    suspend fun retry(job: Job) {
        val nextAttempt = job.attempts + 1
        if (nextAttempt >= job.maxRetries) {
            val serialized = json.encodeToString(job.copy(attempts = nextAttempt))
            redis.rpush(DLQ_KEY, serialized)
            log.warn("Job {} moved to DLQ after {} attempts", job.id, nextAttempt)
            return
        }

        val backoffMs = BASE_BACKOFF_MS * (1L shl nextAttempt.coerceAtMost(10))
        val retryJob = job.copy(attempts = nextAttempt)
        val processAt = Clock.System.now().toEpochMilliseconds() + backoffMs
        val serialized = json.encodeToString(retryJob)
        redis.zadd(DELAYED_KEY, processAt.toDouble(), serialized)
        log.info("Job {} retry #{} in {}ms", job.id, nextAttempt, backoffMs)
    }

    /**
     * Scheduler coroutine: moves delayed jobs whose processAt has arrived
     * from the sorted set into their respective queues.
     */
    suspend fun startDelayedScheduler(scope: CoroutineScope) {
        scope.launch {
            while (isActive) {
                try {
                    val now = Clock.System.now().toEpochMilliseconds().toDouble()
                    val ready = redis.zrangebyscore(DELAYED_KEY, io.lettuce.core.Range.create(0.0, now))
                        ?.toList() ?: emptyList()

                    for (serialized in ready) {
                        val job = json.decodeFromString(Job.serializer(), serialized)
                        redis.rpush(queueKey(job.type), serialized)
                        redis.zrem(DELAYED_KEY, serialized)
                        log.debug("Promoted delayed job {} to queue {}", job.id, job.type)
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    log.error("Delayed scheduler error: {}", e.message)
                }
                delay(1000)
            }
        }
    }

    /** Get the count of jobs in DLQ. */
    suspend fun dlqSize(): Long = redis.llen(DLQ_KEY) ?: 0L

    /** Get the count of pending jobs for a type. */
    suspend fun queueSize(type: String): Long = redis.llen(queueKey(type)) ?: 0L

    fun close() {
        connection.close()
        client.shutdown()
    }

    private fun queueKey(type: String) = "$QUEUE_PREFIX:$type"
}
