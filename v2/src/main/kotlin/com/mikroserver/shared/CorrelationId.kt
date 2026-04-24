package com.mikroserver.shared

import kotlinx.coroutines.slf4j.MDCContext
import kotlinx.coroutines.withContext
import org.slf4j.MDC
import java.util.UUID

/** MDC key for distributed tracing / request correlation. */
const val CORRELATION_ID_KEY = "correlationId"

/** Header name used by clients and Nginx to propagate correlation IDs. */
const val CORRELATION_ID_HEADER = "X-Correlation-Id"

/** Generate a new correlation ID. */
fun newCorrelationId(): String = UUID.randomUUID().toString()

/** Run [block] with [correlationId] in the SLF4J MDC so all log lines carry it. */
suspend fun <T> withCorrelationId(correlationId: String, block: suspend () -> T): T {
    MDC.put(CORRELATION_ID_KEY, correlationId)
    return try {
        withContext(MDCContext()) {
            block()
        }
    } finally {
        MDC.remove(CORRELATION_ID_KEY)
    }
}
