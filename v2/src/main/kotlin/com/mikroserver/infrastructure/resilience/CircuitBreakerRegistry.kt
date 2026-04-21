package com.mikroserver.infrastructure.resilience

import io.github.resilience4j.circuitbreaker.CircuitBreaker
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry
import org.slf4j.LoggerFactory
import java.time.Duration
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Per-router circuit breaker registry.
 * 50% failure threshold, 30s open state, 20-call sliding window — mirrors v1's opossum config.
 */
class RouterCircuitBreakerRegistry {

    private val log = LoggerFactory.getLogger(RouterCircuitBreakerRegistry::class.java)

    private val config = CircuitBreakerConfig.custom()
        .failureRateThreshold(50f)
        .waitDurationInOpenState(Duration.ofSeconds(30))
        .slidingWindowSize(20)
        .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
        .permittedNumberOfCallsInHalfOpenState(5)
        .automaticTransitionFromOpenToHalfOpenEnabled(true)
        .build()

    private val registry = CircuitBreakerRegistry.of(config)
    private val breakers = ConcurrentHashMap<UUID, CircuitBreaker>()

    /** Get or create a circuit breaker for the given router. */
    fun forRouter(routerId: UUID): CircuitBreaker =
        breakers.computeIfAbsent(routerId) { id ->
            val cb = registry.circuitBreaker("router-$id")
            cb.eventPublisher
                .onStateTransition { event ->
                    log.warn(
                        "CircuitBreaker router={} transition: {} → {}",
                        id,
                        event.stateTransition.fromState,
                        event.stateTransition.toState,
                    )
                }
            cb
        }

    /** Snapshot of all breaker states (for /metrics and /health). */
    fun allStates(): Map<UUID, CircuitBreaker.State> =
        breakers.mapValues { (_, cb) -> cb.state }
}
