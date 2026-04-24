package com.mikroserver.api.dto

import kotlinx.serialization.Serializable

// ── Auth ─────────────────────────────────────────────────────────────────────

@Serializable
data class LoginRequest(val email: String, val password: String)

@Serializable
data class RefreshRequest(val refreshToken: String)

@Serializable
data class TokenResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Long,
    val tokenType: String = "Bearer",
)

// ── Routers ──────────────────────────────────────────────────────────────────

@Serializable
data class CreateRouterRequest(
    val name: String,
    val macAddress: String? = null,
)

@Serializable
data class RouterResponse(
    val id: String,
    val name: String,
    val macAddress: String?,
    val wgAllowedIp: String,
    val status: String,
    val lastHandshakeAt: String?,
    val createdAt: String,
)

@Serializable
data class RouterOnboardResponse(
    val router: RouterResponse,
    val wgProvision: WgProvisionResponse,
)

@Serializable
data class WgProvisionResponse(
    val privateKey: String,
    val publicKey: String,
    val wgIp: String,
    val vpsPublicKey: String,
    val vpsEndpoint: String,
)

// ── Webhooks ─────────────────────────────────────────────────────────────────

@Serializable
data class WebhookAckResponse(
    val received: Boolean = true,
    val transactionId: String? = null,
)

// ── Health ───────────────────────────────────────────────────────────────────

@Serializable
data class HealthResponse(
    val status: String,
    val version: String,
    val uptime: Long,
    val checks: Map<String, String>,
)
