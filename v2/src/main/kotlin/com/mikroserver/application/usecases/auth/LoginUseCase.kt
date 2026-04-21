package com.mikroserver.application.usecases.auth

import com.mikroserver.domain.entities.AuditLog
import com.mikroserver.domain.entities.RefreshToken
import com.mikroserver.domain.repositories.AuditLogRepository
import com.mikroserver.domain.repositories.RefreshTokenRepository
import com.mikroserver.domain.repositories.UserRepository
import com.mikroserver.domain.values.TokenPair
import com.mikroserver.infrastructure.security.JwtService
import com.mikroserver.infrastructure.security.PasswordService
import com.mikroserver.shared.AppError
import com.mikroserver.shared.AppResult
import kotlinx.datetime.Clock
import org.slf4j.LoggerFactory
import java.security.MessageDigest
import java.util.UUID
import kotlin.time.Duration.Companion.days

/**
 * Authenticate a user with email + password, issue access + refresh token pair.
 */
class LoginUseCase(
    private val userRepository: UserRepository,
    private val refreshTokenRepository: RefreshTokenRepository,
    private val auditLogRepository: AuditLogRepository,
    private val jwtService: JwtService,
    private val passwordService: PasswordService,
) {
    private val log = LoggerFactory.getLogger(LoginUseCase::class.java)

    data class Command(val email: String, val password: String, val ipAddress: String? = null)

    /** Execute login. Returns a [TokenPair] on success. */
    suspend fun execute(command: Command): AppResult<TokenPair> {
        val user = userRepository.findByEmail(command.email)
            ?: return AppResult.err(AppError.Unauthorized("Invalid credentials"))

        if (!user.isActive) {
            return AppResult.err(AppError.Unauthorized("Account disabled"))
        }

        if (!passwordService.verify(command.password, user.passwordHash)) {
            log.warn("Failed login attempt for {}", command.email)
            return AppResult.err(AppError.Unauthorized("Invalid credentials"))
        }

        val accessToken = jwtService.issueAccessToken(
            JwtService.AccessTokenClaims(
                userId = user.id,
                operatorId = user.operatorId,
                role = user.role,
                email = user.email,
            ),
        )

        val rawRefreshToken = jwtService.generateRefreshToken()
        val familyId = UUID.randomUUID()
        val now = Clock.System.now()

        refreshTokenRepository.create(
            RefreshToken(
                id = UUID.randomUUID(),
                userId = user.id,
                tokenHash = hashToken(rawRefreshToken),
                familyId = familyId,
                rotatedAt = null,
                revokedAt = null,
                expiresAt = now + 30.days,
                createdAt = now,
            ),
        )

        auditLogRepository.append(
            AuditLog(
                id = UUID.randomUUID(),
                operatorId = user.operatorId,
                actorId = user.id,
                action = "LOGIN",
                resource = "User",
                resourceId = user.id,
                metadata = "{}",
                ipAddress = command.ipAddress,
                createdAt = now,
            ),
        )

        log.info("User {} logged in", user.email)
        return AppResult.ok(
            TokenPair(
                accessToken = accessToken,
                refreshToken = rawRefreshToken,
                expiresIn = jwtService.getAccessTtlSeconds(),
            ),
        )
    }

    companion object {
        fun hashToken(token: String): String {
            val digest = MessageDigest.getInstance("SHA-256")
            return digest.digest(token.toByteArray(Charsets.UTF_8))
                .joinToString("") { "%02x".format(it) }
        }
    }
}
