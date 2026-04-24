package com.mikroserver.api.di

import com.mikroserver.application.usecases.auth.LoginUseCase
import com.mikroserver.application.usecases.auth.RefreshTokenUseCase
import com.mikroserver.application.usecases.router.OnboardRouterUseCase
import com.mikroserver.application.usecases.session.PollSessionsUseCase
import com.mikroserver.application.usecases.voucher.GenerateVoucherUseCase
import com.mikroserver.application.usecases.webhook.ProcessWaveWebhookUseCase
import com.mikroserver.domain.repositories.*
import com.mikroserver.infrastructure.persistence.*
import com.mikroserver.infrastructure.queue.RedisJobQueue
import com.mikroserver.infrastructure.queue.VoucherWorker
import com.mikroserver.infrastructure.resilience.RouterCircuitBreakerRegistry
import com.mikroserver.infrastructure.routeros.RouterOsApiClient
import com.mikroserver.infrastructure.routeros.RouterOsClient
import com.mikroserver.infrastructure.security.HmacVerifier
import com.mikroserver.infrastructure.security.JwtService
import com.mikroserver.infrastructure.security.PasswordService
import com.mikroserver.infrastructure.wave.SandboxWaveClient
import com.mikroserver.infrastructure.wave.WavePaymentClient
import com.mikroserver.infrastructure.wave.WaveWebhookVerifier
import com.mikroserver.infrastructure.wireguard.NsenterWireGuardController
import com.mikroserver.infrastructure.wireguard.WireGuardController
import com.mikroserver.shared.AppConfig
import kotlinx.serialization.json.Json
import org.koin.dsl.module

fun appModule(config: AppConfig) = module {
    // ── Shared ───────────────────────────────────────────────────────────────
    single { config }
    single {
        Json {
            ignoreUnknownKeys = true
            encodeDefaults = true
            isLenient = false
        }
    }

    // ── Infrastructure: Security ─────────────────────────────────────────────
    single { JwtService(get()) }
    single { PasswordService() }
    single { HmacVerifier(config.wave.webhookSecret) }

    // ── Infrastructure: Persistence ──────────────────────────────────────────
    single<OperatorRepository> { ExposedOperatorRepository() }
    single<UserRepository> { ExposedUserRepository() }
    single<RouterRepository> { ExposedRouterRepository() }
    single<PlanRepository> { ExposedPlanRepository() }
    single<TransactionRepository> { ExposedTransactionRepository() }
    single<VoucherRepository> { ExposedVoucherRepository() }
    single<SessionRepository> { ExposedSessionRepository() }
    single<RefreshTokenRepository> { ExposedRefreshTokenRepository() }
    single<AuditLogRepository> { ExposedAuditLogRepository() }
    single<OutboxRepository> { ExposedOutboxRepository(get()) }

    // ── Infrastructure: External ─────────────────────────────────────────────
    single<RouterOsClient> { RouterOsApiClient() }
    single<WireGuardController> { NsenterWireGuardController() }
    single<WavePaymentClient> { SandboxWaveClient() }
    single { WaveWebhookVerifier(get(), get()) }
    single { RouterCircuitBreakerRegistry() }

    // ── Infrastructure: Queue ────────────────────────────────────────────────
    single { RedisJobQueue(config.redis.url, get()) }
    single { VoucherWorker(get(), get(), get()) }

    // ── Application: Use Cases ───────────────────────────────────────────────
    single { LoginUseCase(get(), get(), get(), get(), get()) }
    single { RefreshTokenUseCase(get(), get(), get(), get()) }
    single { OnboardRouterUseCase(get(), get(), get(), get()) }
    single { GenerateVoucherUseCase(get(), get(), get(), get(), get(), get(), get()) }
    single { ProcessWaveWebhookUseCase(get(), get(), get(), get(), get()) }
    single { PollSessionsUseCase(get(), get(), get(), get(), get(), get(), get()) }
}
