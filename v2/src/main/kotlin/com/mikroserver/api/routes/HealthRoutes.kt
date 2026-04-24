package com.mikroserver.api.routes

import com.mikroserver.api.dto.HealthResponse
import com.mikroserver.infrastructure.queue.RedisJobQueue
import com.mikroserver.infrastructure.resilience.RouterCircuitBreakerRegistry
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry
import org.koin.ktor.ext.inject

fun Route.healthRoutes(prometheusMeterRegistry: PrometheusMeterRegistry, startTime: Long) {
    val circuitBreakerRegistry by inject<RouterCircuitBreakerRegistry>()

    get("/health") {
        val uptimeMs = System.currentTimeMillis() - startTime
        val cbStates = circuitBreakerRegistry.allStates()
            .mapKeys { (id, _) -> "router-$id" }
            .mapValues { (_, state) -> state.name }

        call.respond(
            HttpStatusCode.OK,
            HealthResponse(
                status = "UP",
                version = "2.0.0",
                uptime = uptimeMs,
                checks = cbStates + ("database" to "UP"),
            ),
        )
    }

    get("/metrics") {
        call.respond(prometheusMeterRegistry.scrape())
    }
}
