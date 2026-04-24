package com.mikroserver.api.plugins

import com.mikroserver.infrastructure.security.JwtService
import com.mikroserver.shared.AppConfig
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.auth.Authentication
import io.ktor.server.auth.jwt.JWTPrincipal
import io.ktor.server.auth.jwt.jwt
import io.ktor.server.plugins.cors.routing.CORS
import org.koin.ktor.ext.inject

fun Application.configureSecurity() {
    val jwtService by inject<JwtService>()
    val config by inject<AppConfig>()

    install(Authentication) {
        jwt("auth-jwt") {
            verifier(jwtService.jwtVerifier)
            validate { credential ->
                val userId = credential.payload.subject
                val operatorId = credential.payload.getClaim("operatorId")?.asString()
                val role = credential.payload.getClaim("role")?.asString()
                if (userId != null && operatorId != null && role != null) {
                    JWTPrincipal(credential.payload)
                } else {
                    null
                }
            }
            challenge { _, _ ->
                call.respond(
                    io.ktor.http.HttpStatusCode.Unauthorized,
                    com.mikroserver.shared.ErrorResponse(code = "UNAUTHORIZED", message = "Missing or invalid token"),
                )
            }
        }
    }

    install(CORS) {
        for (origin in config.cors.allowedOrigins) {
            allowHost(origin.removePrefix("https://").removePrefix("http://"), schemes = listOf("https", "http"))
        }
        allowHeader(HttpHeaders.Authorization)
        allowHeader(HttpHeaders.ContentType)
        allowHeader("X-Correlation-Id")
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowMethod(HttpMethod.Patch)
    }
}
