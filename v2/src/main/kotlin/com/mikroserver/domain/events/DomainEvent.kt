package com.mikroserver.domain.events

import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import java.util.UUID

/** Base sealed class for all domain events persisted to the outbox. */
sealed class DomainEvent {
    abstract val eventId: UUID
    abstract val occurredAt: Instant
    abstract val aggregateType: String
    abstract val aggregateId: UUID

    data class RouterOnboarded(
        override val aggregateId: UUID,
        val operatorId: UUID,
        val wgAllowedIp: String,
        override val eventId: UUID = UUID.randomUUID(),
        override val occurredAt: Instant = Clock.System.now(),
    ) : DomainEvent() {
        override val aggregateType: String = "Router"
    }

    data class VoucherActivated(
        override val aggregateId: UUID,
        val transactionId: UUID,
        val routerId: UUID,
        val code: String,
        override val eventId: UUID = UUID.randomUUID(),
        override val occurredAt: Instant = Clock.System.now(),
    ) : DomainEvent() {
        override val aggregateType: String = "Voucher"
    }

    data class TransactionPaid(
        override val aggregateId: UUID,
        val waveTransactionId: String,
        val amountXof: Int,
        override val eventId: UUID = UUID.randomUUID(),
        override val occurredAt: Instant = Clock.System.now(),
    ) : DomainEvent() {
        override val aggregateType: String = "Transaction"
    }

    data class RefreshTokenFamilyRevoked(
        override val aggregateId: UUID,
        val familyId: UUID,
        val reason: String,
        override val eventId: UUID = UUID.randomUUID(),
        override val occurredAt: Instant = Clock.System.now(),
    ) : DomainEvent() {
        override val aggregateType: String = "User"
    }

    data class RouterStatusChanged(
        override val aggregateId: UUID,
        val oldStatus: String,
        val newStatus: String,
        override val eventId: UUID = UUID.randomUUID(),
        override val occurredAt: Instant = Clock.System.now(),
    ) : DomainEvent() {
        override val aggregateType: String = "Router"
    }
}
