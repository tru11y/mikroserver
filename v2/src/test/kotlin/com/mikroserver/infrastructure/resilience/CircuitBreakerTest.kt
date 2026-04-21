package com.mikroserver.infrastructure.resilience

import io.github.resilience4j.circuitbreaker.CircuitBreaker
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test
import java.util.UUID

class CircuitBreakerTest {

    private val registry = RouterCircuitBreakerRegistry()

    @Test
    fun `new breaker starts in CLOSED state`() {
        val routerId = UUID.randomUUID()
        val cb = registry.forRouter(routerId)
        cb.state shouldBe CircuitBreaker.State.CLOSED
    }

    @Test
    fun `same router returns same breaker instance`() {
        val routerId = UUID.randomUUID()
        val cb1 = registry.forRouter(routerId)
        val cb2 = registry.forRouter(routerId)
        (cb1 === cb2) shouldBe true
    }

    @Test
    fun `different routers get different breakers`() {
        val cb1 = registry.forRouter(UUID.randomUUID())
        val cb2 = registry.forRouter(UUID.randomUUID())
        (cb1 === cb2) shouldBe false
    }

    @Test
    fun `breaker opens after 50 percent failures in sliding window`() {
        val routerId = UUID.randomUUID()
        val cb = registry.forRouter(routerId)

        // Fill the sliding window (size=20): 10 successes, then 10 failures
        repeat(10) {
            cb.executeRunnable { /* success */ }
        }
        repeat(10) {
            try {
                cb.executeRunnable { throw RuntimeException("simulated failure") }
            } catch (_: RuntimeException) {
                // expected
            }
        }

        // 10/20 = 50% failure rate — should trip at threshold
        cb.state shouldBe CircuitBreaker.State.OPEN
    }

    @Test
    fun `allStates reports all registered breakers`() {
        val id1 = UUID.randomUUID()
        val id2 = UUID.randomUUID()
        registry.forRouter(id1)
        registry.forRouter(id2)

        val states = registry.allStates()
        states.size shouldBe 2
        states[id1] shouldBe CircuitBreaker.State.CLOSED
        states[id2] shouldBe CircuitBreaker.State.CLOSED
    }
}
