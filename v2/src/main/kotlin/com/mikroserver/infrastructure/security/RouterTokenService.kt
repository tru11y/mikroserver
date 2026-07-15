package com.mikroserver.infrastructure.security

import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Derives a router's heartbeat bearer token from its WireGuard public key:
 * `token = HMAC-SHA256(secret, publicKey)`. No per-router secret is stored — the
 * backend recomputes the token from the persisted public key and compares it in
 * constant time. Re-provisioning (new key) naturally rotates the token.
 */
class RouterTokenService(private val secret: String) {

    private val algorithm = "HmacSHA256"

    fun tokenFor(publicKey: String): String {
        val mac = Mac.getInstance(algorithm)
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), algorithm))
        return mac.doFinal(publicKey.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    }

    fun verify(publicKey: String, token: String): Boolean = MessageDigest.isEqual(
        tokenFor(publicKey).toByteArray(Charsets.UTF_8),
        token.lowercase().toByteArray(Charsets.UTF_8),
    )
}
