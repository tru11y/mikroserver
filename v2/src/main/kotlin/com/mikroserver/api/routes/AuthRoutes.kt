package com.mikroserver.api.routes

import com.mikroserver.api.dto.LoginRequest
import com.mikroserver.api.dto.RefreshRequest
import com.mikroserver.api.dto.TokenResponse
import com.mikroserver.api.plugins.AUTH_RATE_LIMIT
import com.mikroserver.api.plugins.mapError
import com.mikroserver.application.usecases.auth.LoginUseCase
import com.mikroserver.application.usecases.auth.RefreshTokenUseCase
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.plugins.ratelimit.rateLimit
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import org.koin.ktor.ext.inject

fun Route.authRoutes() {
    val loginUseCase by inject<LoginUseCase>()
    val refreshTokenUseCase by inject<RefreshTokenUseCase>()

    rateLimit(AUTH_RATE_LIMIT) {
        route("/v1/auth") {
            post("/login") {
                val request = call.receive<LoginRequest>()
                val result = loginUseCase.execute(
                    LoginUseCase.Command(
                        email = request.email,
                        password = request.password,
                        ipAddress = call.request.local.remoteAddress,
                    ),
                )
                when {
                    result.isOk -> {
                        val pair = result.getOrThrow()
                        call.respond(
                            HttpStatusCode.OK,
                            TokenResponse(
                                accessToken = pair.accessToken,
                                refreshToken = pair.refreshToken,
                                expiresIn = pair.expiresIn,
                            ),
                        )
                    }
                    else -> {
                        val (status, body) = mapError(result.errorOrNull()!!)
                        call.respond(status, body)
                    }
                }
            }

            post("/refresh") {
                val request = call.receive<RefreshRequest>()
                val result = refreshTokenUseCase.execute(
                    RefreshTokenUseCase.Command(refreshToken = request.refreshToken),
                )
                when {
                    result.isOk -> {
                        val pair = result.getOrThrow()
                        call.respond(
                            HttpStatusCode.OK,
                            TokenResponse(
                                accessToken = pair.accessToken,
                                refreshToken = pair.refreshToken,
                                expiresIn = pair.expiresIn,
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
