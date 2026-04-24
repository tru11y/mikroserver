package com.mikroserver.infrastructure.wave

import com.mikroserver.shared.AppConfig
import com.mikroserver.shared.AppError
import com.mikroserver.shared.AppResult
import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory

/** Port: Wave Mobile Money payment operations. */
interface WavePaymentClient {
    /** Initiate a checkout session. Returns a checkout URL for the customer. */
    suspend fun createCheckout(request: CheckoutRequest): AppResult<CheckoutResponse>
}

@Serializable
data class CheckoutRequest(
    val amount: Int,
    val currency: String = "XOF",
    val clientReference: String,
    val successUrl: String? = null,
    val errorUrl: String? = null,
)

@Serializable
data class CheckoutResponse(
    val checkoutUrl: String,
    val waveTransactionId: String,
)

/**
 * Sandbox Wave client — issues fake checkout URLs for development.
 * In production, replace with [ProductionWaveClient].
 */
class SandboxWaveClient : WavePaymentClient {
    private val log = LoggerFactory.getLogger(SandboxWaveClient::class.java)

    override suspend fun createCheckout(request: CheckoutRequest): AppResult<CheckoutResponse> {
        log.info("SANDBOX: creating checkout for {} XOF, ref={}", request.amount, request.clientReference)
        return AppResult.ok(
            CheckoutResponse(
                checkoutUrl = "https://sandbox.wave.com/checkout/${request.clientReference}",
                waveTransactionId = "wave-sandbox-${request.clientReference}",
            ),
        )
    }
}

/**
 * Production Wave client stub.
 * Replace the TODO with actual Wave API integration when credentials are available.
 */
class ProductionWaveClient(
    private val httpClient: HttpClient,
    private val config: AppConfig,
    private val json: Json,
) : WavePaymentClient {

    private val log = LoggerFactory.getLogger(ProductionWaveClient::class.java)

    override suspend fun createCheckout(request: CheckoutRequest): AppResult<CheckoutResponse> {
        return try {
            val response = httpClient.post("${config.wave.apiBaseUrl}/checkout/sessions") {
                contentType(ContentType.Application.Json)
                header("Authorization", "Bearer ${config.wave.apiKey}")
                setBody(json.encodeToString(CheckoutRequest.serializer(), request))
            }
            if (response.status.isSuccess()) {
                val body = json.decodeFromString(CheckoutResponse.serializer(), response.bodyAsText())
                AppResult.ok(body)
            } else {
                log.error("Wave API error: {} {}", response.status.value, response.bodyAsText())
                AppResult.err(AppError.ExternalServiceError("Wave", "HTTP ${response.status.value}"))
            }
        } catch (e: Exception) {
            log.error("Wave API exception: {}", e.message)
            AppResult.err(AppError.ExternalServiceError("Wave", e.message ?: "Unknown error"))
        }
    }
}
