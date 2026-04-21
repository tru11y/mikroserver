package com.mikroserver.api.plugins

import com.mikroserver.shared.AppError
import com.mikroserver.shared.AppException
import com.mikroserver.shared.ErrorResponse
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.response.respond
import org.slf4j.LoggerFactory

private val log = LoggerFactory.getLogger("ErrorHandling")

/**
 * Single place mapping [AppError] → HTTP status + JSON body.
 */
fun Application.configureErrorHandling() {
    install(StatusPages) {
        exception<AppException> { call, cause ->
            val (status, body) = mapError(cause.error)
            call.respond(status, body)
        }

        exception<Throwable> { call, cause ->
            log.error("Unhandled exception", cause)
            call.respond(
                HttpStatusCode.InternalServerError,
                ErrorResponse(code = "INTERNAL_ERROR", message = "An unexpected error occurred"),
            )
        }
    }
}

fun mapError(error: AppError): Pair<HttpStatusCode, ErrorResponse> {
    val status = when (error) {
        is AppError.ValidationError -> HttpStatusCode.BadRequest
        is AppError.NotFound -> HttpStatusCode.NotFound
        is AppError.Unauthorized -> HttpStatusCode.Unauthorized
        is AppError.Forbidden -> HttpStatusCode.Forbidden
        is AppError.Conflict -> HttpStatusCode.Conflict
        is AppError.ExternalServiceError -> HttpStatusCode.BadGateway
        is AppError.InfrastructureError -> HttpStatusCode.InternalServerError
    }
    val body = ErrorResponse(
        code = error.code,
        message = error.message,
        field = if (error is AppError.ValidationError) error.field else null,
    )
    return status to body
}
