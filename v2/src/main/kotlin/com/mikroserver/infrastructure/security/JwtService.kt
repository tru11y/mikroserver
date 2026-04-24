package com.mikroserver.infrastructure.security

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import com.auth0.jwt.interfaces.DecodedJWT
import com.mikroserver.domain.entities.UserRole
import com.mikroserver.shared.AppConfig
import com.mikroserver.shared.AppError
import com.mikroserver.shared.AppResult
import java.security.KeyFactory
import java.security.interfaces.RSAPrivateKey
import java.security.interfaces.RSAPublicKey
import java.security.spec.PKCS8EncodedKeySpec
import java.security.spec.X509EncodedKeySpec
import java.util.Base64
import java.util.Date
import java.util.UUID

/**
 * RS256 JWT service for access and refresh tokens.
 * Private key from PEM file, public key for verification.
 */
class JwtService(config: AppConfig) {

    private val issuer = config.jwt.issuer
    private val audience = config.jwt.audience
    private val accessTtlMs = config.jwt.accessTtlMinutes * 60 * 1000
    private val refreshTtlMs = config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000

    private val privateKey: RSAPrivateKey
    private val publicKey: RSAPublicKey
    private val algorithm: Algorithm

    val jwtVerifier by lazy {
        JWT.require(algorithm)
            .withIssuer(issuer)
            .withAudience(audience)
            .build()
    }

    init {
        privateKey = loadPrivateKey(config.jwt.privateKeyPem)
        publicKey = loadPublicKey(config.jwt.publicKeyPem)
        algorithm = Algorithm.RSA256(publicKey, privateKey)
    }

    data class AccessTokenClaims(
        val userId: UUID,
        val operatorId: UUID,
        val role: UserRole,
        val email: String,
    )

    /** Issue a short-lived access token. */
    fun issueAccessToken(claims: AccessTokenClaims): String {
        val now = Date()
        return JWT.create()
            .withIssuer(issuer)
            .withAudience(audience)
            .withSubject(claims.userId.toString())
            .withClaim("operatorId", claims.operatorId.toString())
            .withClaim("role", claims.role.name)
            .withClaim("email", claims.email)
            .withIssuedAt(now)
            .withExpiresAt(Date(now.time + accessTtlMs))
            .sign(algorithm)
    }

    /** Issue a long-lived refresh token (opaque UUID, not a JWT — stored hashed in DB). */
    fun generateRefreshToken(): String = UUID.randomUUID().toString()

    /** Verify and decode an access token. */
    fun verifyAccessToken(token: String): AppResult<DecodedJWT> =
        try {
            AppResult.ok(jwtVerifier.verify(token))
        } catch (e: Exception) {
            AppResult.err(AppError.Unauthorized("Invalid or expired token: ${e.message}"))
        }

    /** Extract [AccessTokenClaims] from a decoded JWT. */
    fun extractClaims(jwt: DecodedJWT): AccessTokenClaims = AccessTokenClaims(
        userId = UUID.fromString(jwt.subject),
        operatorId = UUID.fromString(jwt.getClaim("operatorId").asString()),
        role = UserRole.valueOf(jwt.getClaim("role").asString()),
        email = jwt.getClaim("email").asString(),
    )

    fun getAccessTtlSeconds(): Long = accessTtlMs / 1000

    fun getRefreshTtlMs(): Long = refreshTtlMs

    private fun loadPrivateKey(pemPath: String): RSAPrivateKey {
        val keyContent = java.io.File(pemPath).readText()
            .replace("-----BEGIN PRIVATE KEY-----", "")
            .replace("-----END PRIVATE KEY-----", "")
            .replace("\\s".toRegex(), "")
        val keyBytes = Base64.getDecoder().decode(keyContent)
        val keySpec = PKCS8EncodedKeySpec(keyBytes)
        return KeyFactory.getInstance("RSA").generatePrivate(keySpec) as RSAPrivateKey
    }

    private fun loadPublicKey(pemPath: String): RSAPublicKey {
        val keyContent = java.io.File(pemPath).readText()
            .replace("-----BEGIN PUBLIC KEY-----", "")
            .replace("-----END PUBLIC KEY-----", "")
            .replace("\\s".toRegex(), "")
        val keyBytes = Base64.getDecoder().decode(keyContent)
        val keySpec = X509EncodedKeySpec(keyBytes)
        return KeyFactory.getInstance("RSA").generatePublic(keySpec) as RSAPublicKey
    }
}
