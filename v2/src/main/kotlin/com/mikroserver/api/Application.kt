package com.mikroserver.api

import com.mikroserver.api.di.appModule
import com.mikroserver.api.plugins.*
import com.mikroserver.api.routes.authRoutes
import com.mikroserver.api.routes.healthRoutes
import com.mikroserver.api.routes.routerRoutes
import com.mikroserver.api.routes.webhookRoutes
import com.mikroserver.application.usecases.session.PollSessionsUseCase
import com.mikroserver.infrastructure.persistence.DatabaseFactory
import com.mikroserver.infrastructure.queue.RedisJobQueue
import com.mikroserver.infrastructure.queue.VoucherWorker
import com.mikroserver.shared.AppConfig
import com.mikroserver.shared.loadAppConfig
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.application.log
import io.ktor.server.routing.routing
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.koin.ktor.ext.inject
import org.koin.ktor.plugin.Koin
import org.koin.logger.slf4jLogger

fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

fun Application.module() {
    val startTime = System.currentTimeMillis()

    // Load config
    val config = environment.loadAppConfig()

    // DI
    install(Koin) {
        slf4jLogger()
        modules(appModule(config))
    }

    // Database
    DatabaseFactory.init(config)

    // Plugins
    configureSerialization()
    configureErrorHandling()
    configureSecurity()
    configureRateLimiting()
    val prometheusMeterRegistry = configureMonitoring()

    // Set logback config for production
    if (config.isProduction) {
        System.setProperty("logback.configurationFile", "logback-prod.xml")
    }

    // Routes
    routing {
        healthRoutes(prometheusMeterRegistry, startTime)
        authRoutes()
        routerRoutes()
        webhookRoutes()
    }

    // Background workers
    val workerScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    val voucherWorker by inject<VoucherWorker>()
    voucherWorker.start(workerScope)

    val jobQueue by inject<RedisJobQueue>()
    kotlinx.coroutines.runBlocking {
        jobQueue.startDelayedScheduler(workerScope)
    }

    val pollSessionsUseCase by inject<PollSessionsUseCase>()
    pollSessionsUseCase.start(workerScope)

    log.info("MikroServer v2 started on port {}", config.environment)
}
