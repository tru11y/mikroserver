package com.mikroserver.api.plugins

import com.mikroserver.domain.entities.UserRole
import com.mikroserver.shared.ErrorResponse
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.createRouteScopedPlugin
import io.ktor.server.auth.jwt.JWTPrincipal
import io.ktor.server.auth.principal
import io.ktor.server.response.respond
import java.util.UUID

/**
 * Route-scoped plugin that enforces role-based authorization.
 * Usage: `install(AuthorizationPlugin) { requiredRole = UserRole.ADMIN }`
 */
class AuthorizationConfig {
    var requiredRole: UserRole = UserRole.VIEWER
}

val AuthorizationPlugin = createRouteScopedPlugin(
    name = "AuthorizationPlugin",
    createConfiguration = ::AuthorizationConfig,
) {
    val required = pluginConfig.requiredRole

    onCall { call ->
        val principal = call.principal<JWTPrincipal>()
        if (principal == null) {
            call.respond(
                HttpStatusCode.Unauthorized,
                ErrorResponse(code = "UNAUTHORIZED", message = "Authentication required"),
            )
            return@onCall
        }
        val roleStr = principal.payload.getClaim("role")?.asString()
        val role = roleStr?.let { runCatching { UserRole.valueOf(it) }.getOrNull() }
        if (role == null || !role.hasAtLeast(required)) {
            call.respond(
                HttpStatusCode.Forbidden,
                ErrorResponse(code = "FORBIDDEN", message = "Requires ${required.name} role or higher"),
            )
            return@onCall
        }
    }
}

/** Extract the authenticated user's ID from the JWT principal. */
fun io.ktor.server.application.ApplicationCall.userId(): UUID =
    UUID.fromString(principal<JWTPrincipal>()?.payload?.subject)

/** Extract the authenticated user's operator ID from the JWT principal. */
fun io.ktor.server.application.ApplicationCall.operatorId(): UUID =
    UUID.fromString(principal<JWTPrincipal>()?.payload?.getClaim("operatorId")?.asString())

/** Extract the authenticated user's role from the JWT principal. */
fun io.ktor.server.application.ApplicationCall.userRole(): UserRole =
    UserRole.valueOf(principal<JWTPrincipal>()?.payload?.getClaim("role")?.asString().orEmpty())
