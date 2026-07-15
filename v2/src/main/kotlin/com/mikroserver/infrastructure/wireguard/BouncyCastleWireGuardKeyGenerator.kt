package com.mikroserver.infrastructure.wireguard

import org.bouncycastle.crypto.generators.X25519KeyPairGenerator
import org.bouncycastle.crypto.params.X25519KeyGenerationParameters
import org.bouncycastle.crypto.params.X25519PrivateKeyParameters
import org.bouncycastle.crypto.params.X25519PublicKeyParameters
import java.security.SecureRandom
import java.util.Base64

/**
 * X25519 keypair generator using BouncyCastle.
 * Equivalent to Node's `crypto.generateKeyPairSync('x25519')` and to `wg genkey`.
 */
class BouncyCastleWireGuardKeyGenerator : WireGuardKeyGenerator {

    private val encoder = Base64.getEncoder()

    override fun generate(): WgKeyPair {
        val generator = X25519KeyPairGenerator()
        generator.init(X25519KeyGenerationParameters(SecureRandom()))
        val keyPair = generator.generateKeyPair()

        val privateKey = keyPair.private as X25519PrivateKeyParameters
        val publicKey = keyPair.public as X25519PublicKeyParameters

        return WgKeyPair(
            privateKey = encoder.encodeToString(privateKey.encoded),
            publicKey = encoder.encodeToString(publicKey.encoded),
        )
    }
}
