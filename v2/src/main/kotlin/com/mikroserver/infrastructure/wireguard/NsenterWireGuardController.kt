package com.mikroserver.infrastructure.wireguard

import com.mikroserver.shared.AppError
import com.mikroserver.shared.AppResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.slf4j.LoggerFactory
import java.io.BufferedReader
import java.util.concurrent.TimeUnit

/**
 * WireGuard controller that shells out via `nsenter --target 1 --net --mount`
 * from a privileged Docker container to manage peers on the host's wg0 interface.
 */
class NsenterWireGuardController : WireGuardController {

    private val log = LoggerFactory.getLogger(NsenterWireGuardController::class.java)

    companion object {
        private const val TIMEOUT_SECONDS = 10L
        private val NSENTER_PREFIX = arrayOf("nsenter", "--target", "1", "--net", "--mount")
    }

    override suspend fun addPeer(
        interfaceName: String,
        publicKey: String,
        allowedIp: String,
    ): AppResult<Unit> {
        val result = exec(
            *NSENTER_PREFIX,
            "wg", "set", interfaceName,
            "peer", publicKey,
            "allowed-ips", "$allowedIp/32",
        )
        return if (result.exitCode == 0) {
            log.info("WG peer added: {} → {}", publicKey.take(8), allowedIp)
            AppResult.ok(Unit)
        } else {
            log.error("WG addPeer failed: {}", result.stderr)
            AppResult.err(AppError.InfrastructureError("wg set failed: ${result.stderr}"))
        }
    }

    override suspend fun removePeer(
        interfaceName: String,
        publicKey: String,
    ): AppResult<Unit> {
        val result = exec(
            *NSENTER_PREFIX,
            "wg", "set", interfaceName,
            "peer", publicKey, "remove",
        )
        return if (result.exitCode == 0) {
            log.info("WG peer removed: {}", publicKey.take(8))
            AppResult.ok(Unit)
        } else {
            log.error("WG removePeer failed: {}", result.stderr)
            AppResult.err(AppError.InfrastructureError("wg remove failed: ${result.stderr}"))
        }
    }

    override suspend fun saveConfig(interfaceName: String): AppResult<Unit> {
        val result = exec(*NSENTER_PREFIX, "wg-quick", "save", interfaceName)
        return if (result.exitCode == 0) {
            log.info("WG config saved for {}", interfaceName)
            AppResult.ok(Unit)
        } else {
            log.error("WG saveConfig failed: {}", result.stderr)
            AppResult.err(AppError.InfrastructureError("wg-quick save failed: ${result.stderr}"))
        }
    }

    override suspend fun getLastHandshake(
        interfaceName: String,
        publicKey: String,
    ): AppResult<Long> {
        val result = exec(*NSENTER_PREFIX, "wg", "show", interfaceName, "latest-handshakes")
        if (result.exitCode != 0) {
            return AppResult.err(AppError.InfrastructureError("wg show failed: ${result.stderr}"))
        }
        val epoch = result.stdout.lines()
            .map { it.split("\t") }
            .firstOrNull { it.size >= 2 && it[0].trim() == publicKey }
            ?.get(1)?.trim()?.toLongOrNull()
            ?: 0L
        return AppResult.ok(epoch)
    }

    private data class ExecResult(val exitCode: Int, val stdout: String, val stderr: String)

    private suspend fun exec(vararg command: String): ExecResult = withContext(Dispatchers.IO) {
        log.debug("exec: {}", command.joinToString(" "))
        val process = ProcessBuilder(*command)
            .redirectErrorStream(false)
            .start()

        val stdout = process.inputStream.bufferedReader().use(BufferedReader::readText)
        val stderr = process.errorStream.bufferedReader().use(BufferedReader::readText)
        process.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS)

        ExecResult(process.exitValue(), stdout, stderr)
    }
}

/**
 * In-memory WireGuard controller for tests.
 * Tracks peers without executing any shell commands.
 */
class InMemoryWireGuardController : WireGuardController {
    val peers = mutableMapOf<String, String>() // publicKey → allowedIp
    var savedConfigs = mutableListOf<String>()

    override suspend fun addPeer(interfaceName: String, publicKey: String, allowedIp: String): AppResult<Unit> {
        peers[publicKey] = allowedIp
        return AppResult.ok(Unit)
    }

    override suspend fun removePeer(interfaceName: String, publicKey: String): AppResult<Unit> {
        peers.remove(publicKey)
        return AppResult.ok(Unit)
    }

    override suspend fun saveConfig(interfaceName: String): AppResult<Unit> {
        savedConfigs.add(interfaceName)
        return AppResult.ok(Unit)
    }

    override suspend fun getLastHandshake(interfaceName: String, publicKey: String): AppResult<Long> =
        AppResult.ok(if (peers.containsKey(publicKey)) System.currentTimeMillis() / 1000 else 0L)
}
