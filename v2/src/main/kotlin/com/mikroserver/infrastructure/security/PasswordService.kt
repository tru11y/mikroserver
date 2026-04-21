package com.mikroserver.infrastructure.security

import de.mkammerer.argon2.Argon2Factory
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Argon2id password hashing per OWASP 2024 recommendations.
 * m=19456 KiB, t=2 iterations, p=1 parallelism.
 */
class PasswordService {

    private val argon2 = Argon2Factory.create(Argon2Factory.Argon2Types.ARGON2id)

    companion object {
        private const val MEMORY_KB = 19456
        private const val ITERATIONS = 2
        private const val PARALLELISM = 1
        private const val HASH_LENGTH = 32
        private const val SALT_LENGTH = 16
    }

    /** Hash a plaintext password. Runs on [Dispatchers.IO] since Argon2 is CPU-bound. */
    suspend fun hash(password: String): String = withContext(Dispatchers.IO) {
        argon2.hash(ITERATIONS, MEMORY_KB, PARALLELISM, password.toCharArray(), SALT_LENGTH, HASH_LENGTH)
    }

    /** Verify a plaintext password against a stored hash. */
    suspend fun verify(password: String, hash: String): Boolean = withContext(Dispatchers.IO) {
        argon2.verify(hash, password.toCharArray())
    }
}
