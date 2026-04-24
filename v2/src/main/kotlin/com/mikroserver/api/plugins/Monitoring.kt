package com.mikroserver.api.plugins

import com.mikroserver.shared.CORRELATION_ID_HEADER
import com.mikroserver.shared.CORRELATION_ID_KEY
import com.mikroserver.shared.newCorrelationId
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.metrics.micrometer.MicrometerMetrics
import io.ktor.server.plugins.callid.CallId
import io.ktor.server.plugins.callid.callIdMdc
import io.ktor.server.plugins.calllogging.CallLogging
import io.micrometer.prometheusmetrics.PrometheusConfig
import io.micrometer.prometheusmetrics.PrometheusMeterRegistry
import org.slf4j.event.Level

fun Application.configureMonitoring(): PrometheusMeterRegistry {
    val prometheusMeterRegistry = PrometheusMeterRegistry(PrometheusConfig.DEFAULT)

    install(CallId) {
        header(CORRELATION_ID_HEADER)
        generate { newCorrelationId() }
        verify { it.isNotEmpty() }
    }

    install(CallLogging) {
        level = Level.INFO
        callIdMdc(CORRELATION_ID_KEY)
        disableDefaultColors()
        filter { call -> call.request.local.uri.let { it != "/health" && it != "/metrics" } }
    }

    install(MicrometerMetrics) {
        registry = prometheusMeterRegistry
    }

    return prometheusMeterRegistry
}
