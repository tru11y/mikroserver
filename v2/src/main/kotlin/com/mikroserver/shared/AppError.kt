package com.mikroserver.shared

import kotlinx.serialization.Serializable

/** Sealed hierarchy of all expected application errors. */
sealed class AppError(val message: String, val code: String) {

    data class ValidationError(
        val field: String,
        val reason: String,
    ) : AppError("Validation failed on '$field': $reason", "VALIDATION_ERROR")

    data class NotFound(
        val resource: String,
        val id: String,
    ) : AppError("$resource '$id' not found", "NOT_FOUND")

    data class Unauthorized(
        val reason: String = "Invalid credentials",
    ) : AppError(reason, "UNAUTHORIZED")

    data class Forbidden(
        val reason: String = "Insufficient permissions",
    ) : AppError(reason, "FORBIDDEN")

    data class Conflict(
        val resource: String,
        val reason: String,
    ) : AppError("Conflict on $resource: $reason", "CONFLICT")

    data class ExternalServiceError(
        val service: String,
        val reason: String,
    ) : AppError("External service '$service' error: $reason", "EXTERNAL_SERVICE_ERROR")

    data class InfrastructureError(
        val reason: String,
    ) : AppError("Infrastructure error: $reason", "INFRASTRUCTURE_ERROR")
}

/** Wire-format error response. */
@Serializable
data class ErrorResponse(
    val code: String,
    val message: String,
    val field: String? = null,
)
