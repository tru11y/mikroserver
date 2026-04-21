package com.mikroserver.infrastructure.wireguard

import org.bouncycastle.crypto.generators.X25519KeyPairGenerator
import org.bouncycastle.crypto.params.X25519KeyGenerationParameters
import org.bouncycastle.crypto.params.X25519PrivateKeyParameters
import org.bouncycastle.crypto.params.X25519PublicKeyParameters
import java.security.SecureRandom
import java.util.Base64

/**
 * Curve25519 keypair generator using BouncyCastle.
 * Equivalent to Node's `crypto.generateKeyPairSync('x25519')`.
 */
object CryptoKeyGenerator {

    data class X25519KeyPair(
        val privateKey: String, // base64
        val publicKey: String,  // base64
    )

    /** Generate a new X25519 keypair, returned as base64-encoded strings. */
    fun generateX25519KeyPair(): X25519KeyPair {
        val generator = X25519KeyPairGenerator()
        generator.init(X25519KeyGenerationParameters(SecureRandom()))
        val keyPair = generator.generateKeyPair()

        val privateKey = keyPair.private as X25519PrivateKeyParameters
        val publicKey = keyPair.public as X25519PublicKeyParameters

        return X25519KeyPair(
            privateKey = Base64.getEncoder().encodeToString(privateKey.encoded),
            publicKey = Base64.getEncoder().encodeToString(publicKey.encoded),
        )
    }
}
