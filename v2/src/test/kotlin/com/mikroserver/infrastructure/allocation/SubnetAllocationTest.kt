package com.mikroserver.infrastructure.allocation

import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.junit.jupiter.api.Test
import java.util.Collections

class SubnetAllocationTest {

    // ── IP allocation ────────────────────────────────────────────────────────

    @Test
    fun `firstFreeIp returns the first octet when none taken`() {
        SubnetAllocation.firstFreeIp(emptySet()) shouldBe "10.66.66.10"
    }

    @Test
    fun `firstFreeIp fills the lowest gap`() {
        val taken = setOf("10.66.66.10", "10.66.66.11", "10.66.66.13")
        SubnetAllocation.firstFreeIp(taken) shouldBe "10.66.66.12"
    }

    @Test
    fun `firstFreeIp returns null when the subnet is exhausted`() {
        val taken = (10..250).map { "10.66.66.$it" }.toSet()
        SubnetAllocation.firstFreeIp(taken).shouldBeNull()
    }

    // ── Port block allocation ─────────────────────────────────────────────────

    @Test
    fun `firstFreePortBase returns the range start when none taken`() {
        SubnetAllocation.firstFreePortBase(emptySet()) shouldBe 19000
    }

    @Test
    fun `firstFreePortBase fills the lowest gap in blocks of ten`() {
        SubnetAllocation.firstFreePortBase(setOf(19000, 19010)) shouldBe 19020
    }

    @Test
    fun `firstFreePortBase returns null when the range is exhausted`() {
        val taken = (19000..19999 step SubnetAllocation.PORT_BLOCK_SIZE).toSet()
        SubnetAllocation.firstFreePortBase(taken).shouldBeNull()
    }

    // ── Concurrency ───────────────────────────────────────────────────────────

    @Test
    fun `parallel allocations under a lock never yield the same IP`() = runBlocking {
        // Simulates the pg_advisory_xact_lock critical section that the DB
        // allocator relies on: read taken set -> pick first free -> commit.
        val taken = Collections.synchronizedSet(mutableSetOf<String>())
        val mutex = Mutex()
        val allocated = (1..200).map {
            async(Dispatchers.Default) {
                mutex.withLock {
                    val ip = SubnetAllocation.firstFreeIp(taken)!!
                    taken.add(ip)
                    ip
                }
            }
        }.awaitAll()
        allocated.toSet().size shouldBe 200
    }
}
