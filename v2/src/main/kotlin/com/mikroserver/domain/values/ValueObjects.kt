package com.mikroserver.domain.values

import kotlinx.serialization.Serializable

/** WireGuard provisioning data returned to the operator app after router onboarding. */
@Serializable
data class WgProvision(
    val privateKey: String,
    val publicKey: String,
    val wgIp: String,
    val vpsPublicKey: String,
    val vpsEndpoint: String,
)

/** Hotspot credentials generated for a voucher. */
@Serializable
data class HotspotCredentials(
    val username: String,
    val password: String,
)

/** Pair of JWT tokens returned on login/refresh. */
@Serializable
data class TokenPair(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Long,
)
