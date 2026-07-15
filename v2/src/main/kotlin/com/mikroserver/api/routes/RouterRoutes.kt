package com.mikroserver.api.routes

import com.mikroserver.api.dto.ProvisionRequest
import com.mikroserver.api.dto.ProvisionResponse
import com.mikroserver.api.dto.RouterResponse
import com.mikroserver.api.dto.RouterStatusResponse
import com.mikroserver.api.plugins.API_RATE_LIMIT
import com.mikroserver.api.plugins.AuthorizationPlugin
import com.mikroserver.api.plugins.mapError
import com.mikroserver.api.plugins.operatorId
import com.mikroserver.application.usecases.router.ProvisioningResult
import com.mikroserver.application.usecases.router.ProvisioningService
import com.mikroserver.domain.entities.Router
import com.mikroserver.domain.entities.UserRole
import com.mikroserver.domain.repositories.RouterRepository
import com.mikroserver.shared.AppError
import com.mikroserver.shared.AppResult
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.application.install
import io.ktor.server.auth.authenticate
import io.ktor.server.plugins.ratelimit.rateLimit
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import org.koin.ktor.ext.inject
import java.util.UUID

fun Route.routerRoutes() {
    val provisioningService by inject<ProvisioningService>()
    val routerRepository by inject<RouterRepository>()

    // ── Router-authenticated (token derived from public key), no operator JWT ──
    rateLimit(API_RATE_LIMIT) {
        route("/v1/routers/{id}/heartbeat") {
            post {
                val id = call.pathUuid() ?: return@post call.respondError(AppError.ValidationError("id", "invalid UUID"))
                val token = call.bearerToken()
                    ?: return@post call.respondError(AppError.Unauthorized("Missing router token"))
                provisioningService.recordHeartbeat(id, token).respondEmptyOr(call)
            }
        }
    }

    // ── Operator-authenticated management ──────────────────────────────────────
    authenticate("auth-jwt") {
        rateLimit(API_RATE_LIMIT) {
            route("/v1/routers") {
                get {
                    val routers = routerRepository.findByOperatorId(call.operatorId())
                    call.respond(routers.map { it.toResponse() })
                }

                post("/provision") {
                    install(AuthorizationPlugin) { requiredRole = UserRole.ADMIN }
                    val body = call.receive<ProvisionRequest>()
                    provisioningService.provision(call.operatorId(), body.name)
                        .respondProvision(call, HttpStatusCode.Created)
                }

                post("/{id}/reprovision") {
                    install(AuthorizationPlugin) { requiredRole = UserRole.ADMIN }
                    val id = call.pathUuid() ?: return@post call.respondError(AppError.ValidationError("id", "invalid UUID"))
                    provisioningService.reprovision(id, call.operatorId())
                        .respondProvision(call, HttpStatusCode.OK)
                }

                get("/{id}/status") {
                    val id = call.pathUuid() ?: return@get call.respondError(AppError.ValidationError("id", "invalid UUID"))
                    when (val r = provisioningService.status(id, call.operatorId())) {
                        is AppResult.Ok -> call.respond(
                            RouterStatusResponse(r.value.status.name, r.value.lastHandshakeAt?.toString()),
                        )
                        is AppResult.Err -> call.respondError(r.error)
                    }
                }

                delete("/{id}") {
                    install(AuthorizationPlugin) { requiredRole = UserRole.ADMIN }
                    val id = call.pathUuid() ?: return@delete call.respondError(AppError.ValidationError("id", "invalid UUID"))
                    provisioningService.revoke(id, call.operatorId()).respondEmptyOr(call)
                }
            }
        }
    }
}

private fun io.ktor.server.application.ApplicationCall.pathUuid(): UUID? =
    parameters["id"]?.let { runCatching { UUID.fromString(it) }.getOrNull() }

private fun io.ktor.server.application.ApplicationCall.bearerToken(): String? =
    request.headers["Authorization"]?.removePrefix("Bearer ")?.trim()?.takeIf { it.isNotEmpty() }

private suspend fun io.ktor.server.application.ApplicationCall.respondError(error: AppError) {
    val (status, body) = mapError(error)
    respond(status, body)
}

private suspend fun AppResult<ProvisioningResult>.respondProvision(
    call: io.ktor.server.application.ApplicationCall,
    okStatus: HttpStatusCode,
) = when (this) {
    is AppResult.Ok -> call.respond(
        okStatus,
        ProvisionResponse(
            routerId = value.routerId.toString(),
            provisioningScript = value.provisioningScript,
            expectedIp = value.expectedIp,
            dnatPortBase = value.dnatPortBase,
            publicManagementUrl = value.publicManagementUrl,
        ),
    )
    is AppResult.Err -> call.respondError(error)
}

private suspend fun AppResult<Unit>.respondEmptyOr(call: io.ktor.server.application.ApplicationCall) = when (this) {
    is AppResult.Ok -> call.respond(HttpStatusCode.NoContent)
    is AppResult.Err -> call.respondError(error)
}

private fun Router.toResponse() = RouterResponse(
    id = id.toString(),
    name = name,
    macAddress = macAddress,
    wgAllowedIp = wgAllowedIp,
    status = status.name,
    lastHandshakeAt = lastHandshakeAt?.toString(),
    createdAt = createdAt.toString(),
)
