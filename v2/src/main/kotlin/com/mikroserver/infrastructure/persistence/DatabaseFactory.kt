package com.mikroserver.infrastructure.persistence

import com.mikroserver.shared.AppConfig
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import kotlinx.coroutines.Dispatchers
import org.flywaydb.core.Flyway
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.slf4j.LoggerFactory

object DatabaseFactory {

    private val log = LoggerFactory.getLogger(DatabaseFactory::class.java)

    fun init(config: AppConfig) {
        val ds = hikariDataSource(config)
        Database.connect(ds)
        runMigrations(ds)
        log.info("Database initialized: pool={}", config.database.maxPoolSize)
    }

    private fun hikariDataSource(config: AppConfig): HikariDataSource {
        val hikariConfig = HikariConfig().apply {
            jdbcUrl = config.database.url
            username = config.database.user
            password = config.database.password
            maximumPoolSize = config.database.maxPoolSize
            isAutoCommit = false
            transactionIsolation = "TRANSACTION_READ_COMMITTED"
            validate()
        }
        return HikariDataSource(hikariConfig)
    }

    private fun runMigrations(dataSource: HikariDataSource) {
        val flyway = Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration")
            .baselineOnMigrate(true)
            .load()
        val result = flyway.migrate()
        log.info("Flyway: applied {} migrations", result.migrationsExecuted)
    }

    /** Execute a suspending transaction on [Dispatchers.IO]. */
    suspend fun <T> dbQuery(block: suspend () -> T): T =
        newSuspendedTransaction(Dispatchers.IO) { block() }
}
