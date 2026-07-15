package com.mikroserver.infrastructure.wireguard

import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import org.junit.jupiter.api.Test
import java.util.Base64

class WireGuardKeyGeneratorTest {

    private val generator = BouncyCastleWireGuardKeyGenerator()

    @Test
    fun `generates valid 32-byte base64 X25519 keys`() {
        val kp = generator.generate()
        Base64.getDecoder().decode(kp.privateKey).size shouldBe 32
        Base64.getDecoder().decode(kp.publicKey).size shouldBe 32
    }

    @Test
    fun `each generation produces a distinct keypair`() {
        val a = generator.generate()
        val b = generator.generate()
        a.privateKey shouldNotBe b.privateKey
        a.publicKey shouldNotBe b.publicKey
    }
}
