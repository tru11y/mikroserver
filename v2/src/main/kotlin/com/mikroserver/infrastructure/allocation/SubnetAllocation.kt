package com.mikroserver.infrastructure.allocation

/**
 * Pure allocation logic for WireGuard IPs and DNAT port blocks.
 * Kept side-effect free so it is trivially unit-testable; the DB locking that
 * makes allocation race-safe lives in the [IpAllocator] / [PortAllocator] impls.
 */
object SubnetAllocation {

    const val WG_SUBNET_PREFIX = "10.66.66."
    const val WG_FIRST_OCTET = 10
    const val WG_LAST_OCTET = 250

    /** First free IP in [WG_FIRST_OCTET]..[WG_LAST_OCTET], filling gaps; null if exhausted. */
    fun firstFreeIp(taken: Set<String>): String? {
        for (octet in WG_FIRST_OCTET..WG_LAST_OCTET) {
            val ip = "$WG_SUBNET_PREFIX$octet"
            if (ip !in taken) return ip
        }
        return null
    }

    const val PORT_RANGE_START = 19000
    const val PORT_RANGE_END = 19999
    const val PORT_BLOCK_SIZE = 10

    /** First free port block base (multiples of [PORT_BLOCK_SIZE]), filling gaps; null if exhausted. */
    fun firstFreePortBase(taken: Set<Int>): Int? {
        var base = PORT_RANGE_START
        while (base + PORT_BLOCK_SIZE - 1 <= PORT_RANGE_END) {
            if (base !in taken) return base
            base += PORT_BLOCK_SIZE
        }
        return null
    }
}
