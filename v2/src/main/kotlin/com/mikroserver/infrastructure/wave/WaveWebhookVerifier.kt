package com.mikroserver.infrastructure.wave

import com.mikroserver.infrastructure.security.HmacVerifier
import com.mikroserver.shared.AppError
import com.mikroserver.shared.AppResult
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory

/** Incoming Wave webhook payload shape. */
@Serializable
data class WaveWebhookPayload(
    val id: String,
    val amount: String,
    val currency: String = "XOF",
    val status: String,
    val clientReference: String? = null,
    val phoneNumber: String? = null,
)

/**
 * Verifies Wave webhook HMAC-SHA256 signature and deserializes the payload.
 * Responds in <3s by returning the parsed payload; processing is async.
 */
class WaveWebhookVerifier(
    private val hmacVerifier: HmacVerifier,
    private val json: Json,
) {
    private val log = LoggerFactory.getLogger(WaveWebhookVerifier::class.java)

    /**
     * Verify the signature and parse the payload.
     * @param rawBody raw request body bytes
     * @param signature value of the Wave-Signature (or similar) header
     */
    fun verifyAndParse(rawBody: ByteArray, signature: String): AppResult<WaveWebhookPayload> {
        if (!hmacVerifier.verify(rawBody, signature)) {
            log.warn("Webhook HMAC verification failed")
            return AppResult.err(AppError.Unauthorized("Invalid webhook signature"))
        }
        return try {
            val payload = json.decodeFromString(WaveWebhookPayload.serializer(), String(rawBody, Charsets.UTF_8))
            AppResult.ok(payload)
        } catch (e: Exception) {
            log.error("Webhook payload parse error: {}", e.message)
            AppResult.err(AppError.ValidationError("body", "Malformed webhook payload"))
        }
    }
}
