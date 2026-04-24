package com.mikroserver.api.routes

import com.mikroserver.api.dto.CreateRouterRequest
import com.mikroserver.api.dto.RouterOnboardResponse
import com.mikroserver.api.dto.RouterResponse
import com.mikroserver.api.dto.WgProvisionResponse
import com.mikroserver.api.plugins.API_RATE_LIMIT
import com.mikroserver.api.plugins.AuthorizationPlugin
import com.mikroserver.api.plugins.mapError
import com.mikroserver.api.plugins.operatorId
import com.mikroserver.application.usecases.router.OnboardRouterUseCase
import com.mikroserver.domain.entities.UserRole
import com.mikroserver.domain.repositories.RouterRepository
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.application.install
import io.ktor.server.auth.authenticate
import io.ktor.server.plugins.ratelimit.rateLimit
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import org.koin.ktor.ext.inject

fun Route.routerRoutes() {
    val onboardRouterUseCase by inject<OnboardRouterUseCase>()
    val routerRepository by inject<RouterRepository>()

    authenticate("auth-jwt") {
        rateLimit(API_RATE_LIMIT) {
            route("/v1/routers") {
                // List routers for the authenticated operator
                get {
                    val routers = routerRepository.findByOperatorId(call.operatorId())
                    call.respond(routers.map { it.toResponse() })
                }

                // Onboard a new router (ADMIN+)
                post {
                    install(AuthorizationPlugin) { requiredRole = UserRole.ADMIN }

                    val request = call.receive<CreateRouterRequest>()
                    val result = onboardRouterUseCase.execute(
                        OnboardRouterUseCase.Command(
                            operatorId = call.operatorId(),
                            name = request.name,
                            macAddress = request.macAddress,
                        ),
                    )
                    when {
                        result.isOk -> {
                            val data = result.getOrThrow()
                            call.respond(
                                HttpStatusCode.Created,
                                RouterOnboardResponse(
                                    router = data.router.toResponse(),
                                    wgProvision = WgProvisionResponse(
                                        privateKey = data.wgProvision.privateKey,
                                        publicKey = data.wgProvision.publicKey,
                                        wgIp = data.wgProvision.wgIp,
                                        vpsPublicKey = data.wgProvision.vpsPublicKey,
                                        vpsEndpoint = data.wgProvision.vpsEndpoint,
                                    ),
                                ),
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
}

private fun com.mikroserver.domain.entities.Router.toResponse() = RouterResponse(
    id = id.toString(),
    name = name,
    macAddress = macAddress,
    wgAllowedIp = wgAllowedIp,
    status = status.name,
    lastHandshakeAt = lastHandshakeAt?.toString(),
    createdAt = createdAt.toString(),
)
