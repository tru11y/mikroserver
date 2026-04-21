package com.mikroserver.infrastructure.security

import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldStartWith
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Test

class PasswordServiceTest {

    private val service = PasswordService()

    @Test
    fun `hash produces argon2id hash`() = runTest {
        val hash = service.hash("SuperSecret123!")
        hash shouldStartWith "\$argon2id\$"
    }

    @Test
    fun `verify succeeds with correct password`() = runTest {
        val hash = service.hash("CorrectPassword")
        service.verify("CorrectPassword", hash) shouldBe true
    }

    @Test
    fun `verify fails with wrong password`() = runTest {
        val hash = service.hash("CorrectPassword")
        service.verify("WrongPassword", hash) shouldBe false
    }

    @Test
    fun `different passwords produce different hashes`() = runTest {
        val hash1 = service.hash("password1")
        val hash2 = service.hash("password2")
        (hash1 == hash2) shouldBe false
    }

    @Test
    fun `same password produces different hashes due to salt`() = runTest {
        val hash1 = service.hash("SamePassword")
        val hash2 = service.hash("SamePassword")
        (hash1 == hash2) shouldBe false
    }
}
