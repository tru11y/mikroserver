package com.mikroserver.domain.entities

import kotlinx.serialization.Serializable

@Serializable
enum class RouterStatus { OFFLINE, ONLINE, DEGRADED }

@Serializable
enum class VoucherStatus { PENDING, ACTIVE, CONSUMED, EXPIRED }

@Serializable
enum class TransactionStatus { PENDING, PAID, FAILED, REFUNDED }

@Serializable
enum class UserRole {
    VIEWER, ADMIN, SUPER_ADMIN;

    /** Returns true if this role has at least the privileges of [required]. */
    fun hasAtLeast(required: UserRole): Boolean = this.ordinal >= required.ordinal
}

@Serializable
enum class OperatorTier { FREE, PRO, ENTERPRISE }
