package com.mikroserver.application.usecases.auth

import com.mikroserver.domain.entities.RefreshToken
import com.mikroserver.domain.events.DomainEvent
import com.mikroserver.domain.repositories.OutboxRepository
import com.mikroserver.domain.repositories.RefreshTokenRepository
import com.mikroserver.domain.repositories.UserRepository
import com.mikroserver.domain.values.TokenPair
import com.mikroserver.infrastructure.security.JwtService
import com.mikroserver.shared.AppError
import com.mikroserver.shared.AppResult
import kotlinx.datetime.Clock
import org.slf4j.LoggerFactory
import java.util.UUID
import kotlin.time.Duration.Companion.days

/**
 * Rotate a refresh token: issue new access + refresh pair, revoke the old one.
 * If a revoked token from the same family is presented, revoke the entire family
 * (reuse detection — indicates the token was stolen).
 */
class RefreshTokenUseCase(
    private val userRepository: UserRepository,
    private val refreshTokenRepository: RefreshTokenRepository,
    private val outboxRepository: OutboxRepository,
    private val jwtService: JwtService,
) {
    private val log = LoggerFactory.getLogger(RefreshTokenUseCase::class.java)

    data class Command(val refreshToken: String)

    suspend fun execute(command: Command): AppResult<TokenPair> {
        val tokenHash = LoginUseCase.hashToken(command.refreshToken)
        val storedToken = refreshTokenRepository.findByTokenHash(tokenHash)
            ?: return AppResult.err(AppError.Unauthorized("Invalid refresh token"))

        val now = Clock.System.now()

        // Reuse detection: if token is already revoked, revoke entire family
        if (storedToken.revokedAt != null) {
            log.warn("Refresh token reuse detected! family={} user={}", storedToken.familyId, storedToken.userId)
            refreshTokenRepository.revokeByFamilyId(storedToken.familyId)
            outboxRepository.save(
                DomainEvent.RefreshTokenFamilyRevoked(
                    aggregateId = storedToken.userId,
                    familyId = storedToken.familyId,
                    reason = "Token reuse detected",
                ),
            )
            return AppResult.err(AppError.Unauthorized("Token reuse detected — all sessions revoked"))
        }

        // Check expiry
        if (now > storedToken.expiresAt) {
            return AppResult.err(AppError.Unauthorized("Refresh token expired"))
        }

        // Revoke current token (mark as rotated)
        refreshTokenRepository.revokeById(storedToken.id)

        val user = userRepository.findById(storedToken.userId)
            ?: return AppResult.err(AppError.NotFound("User", storedToken.userId.toString()))

        if (!user.isActive) {
            return AppResult.err(AppError.Unauthorized("Account disabled"))
        }

        // Issue new tokens in the same family
        val newRawRefreshToken = jwtService.generateRefreshToken()
        refreshTokenRepository.create(
            RefreshToken(
                id = UUID.randomUUID(),
                userId = user.id,
                tokenHash = LoginUseCase.hashToken(newRawRefreshToken),
                familyId = storedToken.familyId,
                rotatedAt = null,
                revokedAt = null,
                expiresAt = now + 30.days,
                createdAt = now,
            ),
        )

        val accessToken = jwtService.issueAccessToken(
            JwtService.AccessTokenClaims(
                userId = user.id,
                operatorId = user.operatorId,
                role = user.role,
                email = user.email,
            ),
        )

        log.info("Token rotated for user {} family={}", user.email, storedToken.familyId)
        return AppResult.ok(
            TokenPair(
                accessToken = accessToken,
                refreshToken = newRawRefreshToken,
                expiresIn = jwtService.getAccessTtlSeconds(),
            ),
        )
    }
}
