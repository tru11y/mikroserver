package com.mikroserver.infrastructure.security

import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * HMAC-SHA256 webhook signature verifier with constant-time comparison.
 * Used for Wave Mobile Money webhook authentication.
 */
class HmacVerifier(private val secret: String) {

    private val algorithm = "HmacSHA256"

    /**
     * Verify that [signature] matches the HMAC-SHA256 of [payload].
     * Uses [MessageDigest.isEqual] for constant-time comparison to prevent timing attacks.
     */
    fun verify(payload: ByteArray, signature: String): Boolean {
        val mac = Mac.getInstance(algorithm)
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), algorithm))
        val expected = mac.doFinal(payload)
        val expectedHex = expected.joinToString("") { "%02x".format(it) }
        return MessageDigest.isEqual(
            expectedHex.toByteArray(Charsets.UTF_8),
            signature.lowercase().toByteArray(Charsets.UTF_8),
        )
    }

    /** Compute HMAC-SHA256 hex digest of [payload]. */
    fun sign(payload: ByteArray): String {
        val mac = Mac.getInstance(algorithm)
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), algorithm))
        return mac.doFinal(payload).joinToString("") { "%02x".format(it) }
    }
}
