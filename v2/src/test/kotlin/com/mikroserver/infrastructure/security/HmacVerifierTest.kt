package com.mikroserver.infrastructure.security

import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test

class HmacVerifierTest {

    private val secret = "test-webhook-secret-256bit-key!!"
    private val verifier = HmacVerifier(secret)

    @Test
    fun `valid signature passes verification`() {
        val payload = """{"id":"txn_123","amount":"500","status":"succeeded"}""".toByteArray()
        val signature = verifier.sign(payload)
        verifier.verify(payload, signature) shouldBe true
    }

    @Test
    fun `invalid signature fails verification`() {
        val payload = """{"id":"txn_123","amount":"500","status":"succeeded"}""".toByteArray()
        verifier.verify(payload, "deadbeef0000") shouldBe false
    }

    @Test
    fun `tampered payload fails verification`() {
        val payload = """{"id":"txn_123","amount":"500","status":"succeeded"}""".toByteArray()
        val signature = verifier.sign(payload)
        val tampered = """{"id":"txn_123","amount":"9999","status":"succeeded"}""".toByteArray()
        verifier.verify(tampered, signature) shouldBe false
    }

    @Test
    fun `signature comparison is case-insensitive`() {
        val payload = "test".toByteArray()
        val signature = verifier.sign(payload)
        verifier.verify(payload, signature.uppercase()) shouldBe true
    }

    @Test
    fun `different secret produces different signature`() {
        val payload = "test".toByteArray()
        val sig1 = verifier.sign(payload)
        val sig2 = HmacVerifier("different-secret-key-here!!!!!!").sign(payload)
        (sig1 == sig2) shouldBe false
    }
}
