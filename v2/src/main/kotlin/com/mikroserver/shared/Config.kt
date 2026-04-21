package com.mikroserver.shared

import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationEnvironment

/** Type-safe configuration loaded from application.conf (HOCON). */
data class AppConfig(
    val database: DatabaseConfig,
    val redis: RedisConfig,
    val jwt: JwtConfig,
    val wave: WaveConfig,
    val wireguard: WireGuardConfig,
    val cors: CorsConfig,
    val environment: String,
) {
    val isProduction: Boolean get() = environment == "production"
}

data class DatabaseConfig(
    val url: String,
    val user: String,
    val password: String,
    val maxPoolSize: Int,
)

data class RedisConfig(
    val url: String,
)

data class JwtConfig(
    val privateKeyPem: String,
    val publicKeyPem: String,
    val issuer: String,
    val audience: String,
    val accessTtlMinutes: Long,
    val refreshTtlDays: Long,
)

data class WaveConfig(
    val webhookSecret: String,
    val apiBaseUrl: String,
    val apiKey: String?,
)

data class WireGuardConfig(
    val interfaceName: String,
    val serverAddress: String,
    val subnet: String,
    val serverPort: Int,
    val serverEndpoint: String,
    val serverPublicKey: String?,
)

data class CorsConfig(
    val allowedOrigins: List<String>,
)

/** Parse [AppConfig] from Ktor's HOCON environment. */
fun ApplicationEnvironment.loadAppConfig(): AppConfig {
    val c = config
    return AppConfig(
        database = DatabaseConfig(
            url = c.property("database.url").getString(),
            user = c.property("database.user").getString(),
            password = c.property("database.password").getString(),
            maxPoolSize = c.property("database.maxPoolSize").getString().toInt(),
        ),
        redis = RedisConfig(
            url = c.property("redis.url").getString(),
        ),
        jwt = JwtConfig(
            privateKeyPem = c.property("jwt.privateKeyPem").getString(),
            publicKeyPem = c.property("jwt.publicKeyPem").getString(),
            issuer = c.property("jwt.issuer").getString(),
            audience = c.property("jwt.audience").getString(),
            accessTtlMinutes = c.property("jwt.accessTtlMinutes").getString().toLong(),
            refreshTtlDays = c.property("jwt.refreshTtlDays").getString().toLong(),
        ),
        wave = WaveConfig(
            webhookSecret = c.property("wave.webhookSecret").getString(),
            apiBaseUrl = c.property("wave.apiBaseUrl").getString(),
            apiKey = c.propertyOrNull("wave.apiKey")?.getString(),
        ),
        wireguard = WireGuardConfig(
            interfaceName = c.property("wireguard.interface").getString(),
            serverAddress = c.property("wireguard.serverAddress").getString(),
            subnet = c.property("wireguard.subnet").getString(),
            serverPort = c.property("wireguard.serverPort").getString().toInt(),
            serverEndpoint = c.property("wireguard.serverEndpoint").getString(),
            serverPublicKey = c.propertyOrNull("wireguard.serverPublicKey")?.getString(),
        ),
        cors = CorsConfig(
            allowedOrigins = c.property("cors.allowedOrigins").getString()
                .split(",").map { it.trim() }.filter { it.isNotEmpty() },
        ),
        environment = c.property("app.environment").getString(),
    )
}
