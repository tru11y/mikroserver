package com.mikroserver.infrastructure.allocation

import com.mikroserver.infrastructure.persistence.RoutersTable
import com.mikroserver.shared.AppError
import com.mikroserver.shared.AppResult
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.TransactionManager

/** Allocates the next free WireGuard /32 address for a router peer. */
interface IpAllocator {
    /** Must be called inside an active Exposed transaction. */
    fun allocate(): AppResult<String>
}

/** Allocates the next free DNAT port block (10 ports) for a router's management planes. */
interface PortAllocator {
    /** Must be called inside an active Exposed transaction. */
    fun allocate(): AppResult<Int>
}

/**
 * Postgres advisory lock keys — one per allocatable resource. Held for the
 * duration of the enclosing transaction so concurrent provisions serialize on
 * the "read taken set → pick first free → insert" critical section.
 */
private const val IP_ALLOC_LOCK = 0x1066_0010L
private const val PORT_ALLOC_LOCK = 0x1066_0011L

/** Take a transaction-scoped advisory lock; released automatically at commit/rollback. */
private fun pgAdvisoryXactLock(key: Long) {
    TransactionManager.current().exec("SELECT pg_advisory_xact_lock($key)")
}

/**
 * Reads currently-allocated WG IPs (status <> REVOKED, so revoked routers free
 * their address) with a row lock, then returns the first free one. Callers must
 * INSERT the router row within the SAME transaction so the advisory lock still
 * guards against a concurrent allocator picking the same IP.
 */
class ExposedIpAllocator : IpAllocator {
    override fun allocate(): AppResult<String> {
        pgAdvisoryXactLock(IP_ALLOC_LOCK)
        val taken = RoutersTable
            .selectAll()
            .where { RoutersTable.status neq "REVOKED" }
            .forUpdate()
            .map { it[RoutersTable.wgAllowedIp] }
            .toSet()
        return SubnetAllocation.firstFreeIp(taken)
            ?.let { AppResult.ok(it) }
            ?: AppResult.err(AppError.InfrastructureError("WireGuard subnet exhausted"))
    }
}

class ExposedPortAllocator : PortAllocator {
    override fun allocate(): AppResult<Int> {
        pgAdvisoryXactLock(PORT_ALLOC_LOCK)
        val taken = RoutersTable
            .selectAll()
            .where { RoutersTable.status neq "REVOKED" }
            .forUpdate()
            .map { it[RoutersTable.dnatPortBase] }
            .toSet()
        return SubnetAllocation.firstFreePortBase(taken)
            ?.let { AppResult.ok(it) }
            ?: AppResult.err(AppError.InfrastructureError("DNAT port range exhausted"))
    }
}
