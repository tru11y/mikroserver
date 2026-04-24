package com.mikroserver.api.routes

import com.mikroserver.api.dto.WebhookAckResponse
import com.mikroserver.api.plugins.WEBHOOK_RATE_LIMIT
import com.mikroserver.api.plugins.mapError
import com.mikroserver.application.usecases.webhook.ProcessWaveWebhookUseCase
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.plugins.ratelimit.rateLimit
import io.ktor.server.request.receiveChannel
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import io.ktor.utils.io.readRemaining
import kotlinx.io.readByteArray
import org.koin.ktor.ext.inject
import java.util.UUID

fun Route.webhookRoutes() {
    val processWebhookUseCase by inject<ProcessWaveWebhookUseCase>()

    rateLimit(WEBHOOK_RATE_LIMIT) {
        route("/v1/webhooks") {
            post("/wave/{operatorId}/{routerId}") {
                val operatorId = call.parameters["operatorId"]?.let { UUID.fromString(it) }
                    ?: return@post call.respond(HttpStatusCode.BadRequest, "Missing operatorId")
                val routerId = call.parameters["routerId"]?.let { UUID.fromString(it) }
                    ?: return@post call.respond(HttpStatusCode.BadRequest, "Missing routerId")

                val signature = call.request.headers["Wave-Signature"]
                    ?: call.request.headers["X-Webhook-Signature"]
                    ?: return@post call.respond(HttpStatusCode.Unauthorized, "Missing signature header")

                val rawBody = call.receiveChannel().readRemaining().readByteArray()

                val result = processWebhookUseCase.execute(
                    ProcessWaveWebhookUseCase.Command(
                        rawBody = rawBody,
                        signature = signature,
                        operatorId = operatorId,
                        routerId = routerId,
                    ),
                )

                when {
                    result.isOk -> {
                        val txn = result.getOrThrow()
                        call.respond(
                            HttpStatusCode.OK,
                            WebhookAckResponse(received = true, transactionId = txn.id.toString()),
                        )
                    }
                    else -> {
                        val (status, body) = mapError(result.errorOrNull()!!)
                        call.respond(status, body)
                    }
                }
            }
        }
    }
}
