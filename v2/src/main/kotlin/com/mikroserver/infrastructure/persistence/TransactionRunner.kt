package com.mikroserver.infrastructure.persistence

/**
 * Runs a block inside a single database transaction. Lets use-cases compose
 * allocation + insert atomically (the allocators hold a `pg_advisory_xact_lock`
 * that must live until the row is committed) while staying unit-testable behind
 * a trivial pass-through fake.
 */
interface TransactionRunner {
    suspend fun <T> inTransaction(block: suspend () -> T): T
}

class ExposedTransactionRunner : TransactionRunner {
    override suspend fun <T> inTransaction(block: suspend () -> T): T =
        DatabaseFactory.dbQuery { block() }
}
