package com.mikroserver.infrastructure.wireguard

/**
 * Generates ephemeral Curve25519 (X25519) keypairs for WireGuard peers.
 *
 * Security contract: the [WgKeyPair.privateKey] is EPHEMERAL. It must never be
 * persisted nor logged — it is returned once to the mobile app in the
 * provisioning response, injected into the RouterOS script, then dropped.
 */
interface WireGuardKeyGenerator {
    fun generate(): WgKeyPair
}

/** X25519 keypair, both keys base64-encoded (32 raw bytes each). */
data class WgKeyPair(
    val privateKey: String,
    val publicKey: String,
)
