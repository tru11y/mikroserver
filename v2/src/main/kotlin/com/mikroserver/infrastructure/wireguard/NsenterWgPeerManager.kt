package com.mikroserver.infrastructure.wireguard

import com.mikroserver.shared.AppError
import com.mikroserver.shared.AppResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.slf4j.LoggerFactory
import java.io.BufferedReader
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * [WgPeerManager] backed by `nsenter --target 1 --net --mount` from a privileged
 * container, acting on the host's wg0 interface and /etc/wireguard/peers.d.
 */
class NsenterWgPeerManager(
    private val interfaceName: String,
) : WgPeerManager {

    private val log = LoggerFactory.getLogger(NsenterWgPeerManager::class.java)

    override suspend fun addPeer(routerId: UUID, publicKey: String, wgIp: String): AppResult<Unit> {
        val live = exec(
            *NSENTER_PREFIX,
            "wg", "set", interfaceName, "peer", publicKey, "allowed-ips", "$wgIp/32",
        )
        if (live.exitCode != 0) {
            log.error("WG addPeer failed: {}", live.stderr)
            return AppResult.err(AppError.InfrastructureError("wg set failed: ${live.stderr}"))
        }
        // Persist so the peer survives a reboot (re-loaded by reload-peers.sh).
        val persist = exec(
            *NSENTER_PREFIX,
            "sh", "-c", "mkdir -p ${WgPeerFiles.PEERS_DIR} && cat > ${WgPeerFiles.peerConfPath(routerId)}",
            stdin = WgPeerFiles.peerConfContent(publicKey, wgIp),
        )
        if (persist.exitCode != 0) {
            log.error("WG peers.d persist failed for {}: {}", routerId, persist.stderr)
            return AppResult.err(AppError.InfrastructureError("peers.d write failed: ${persist.stderr}"))
        }
        log.info("WG peer added: router={} key={} ip={}", routerId, publicKey.take(8), wgIp)
        return AppResult.ok(Unit)
    }

    override suspend fun removePeer(routerId: UUID, publicKey: String): AppResult<Unit> {
        val live = exec(*NSENTER_PREFIX, "wg", "set", interfaceName, "peer", publicKey, "remove")
        if (live.exitCode != 0) {
            log.error("WG removePeer failed: {}", live.stderr)
            return AppResult.err(AppError.InfrastructureError("wg remove failed: ${live.stderr}"))
        }
        exec(*NSENTER_PREFIX, "rm", "-f", WgPeerFiles.peerConfPath(routerId))
        log.info("WG peer removed: router={} key={}", routerId, publicKey.take(8))
        return AppResult.ok(Unit)
    }

    override suspend fun listPeersWithHandshake(): AppResult<List<PeerHandshake>> {
        val result = exec(*NSENTER_PREFIX, "wg", "show", interfaceName, "dump")
        return if (result.exitCode == 0) {
            AppResult.ok(WgPeerFiles.parseDump(result.stdout))
        } else {
            AppResult.err(AppError.InfrastructureError("wg show dump failed: ${result.stderr}"))
        }
    }

    private data class ExecResult(val exitCode: Int, val stdout: String, val stderr: String)

    private suspend fun exec(vararg command: String, stdin: String? = null): ExecResult =
        withContext(Dispatchers.IO) {
            val process = ProcessBuilder(*command).redirectErrorStream(false).start()
            stdin?.let { process.outputStream.bufferedWriter().use { w -> w.write(it) } }
            val stdout = process.inputStream.bufferedReader().use(BufferedReader::readText)
            val stderr = process.errorStream.bufferedReader().use(BufferedReader::readText)
            process.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS)
            ExecResult(process.exitValue(), stdout, stderr)
        }

    companion object {
        private const val TIMEOUT_SECONDS = 10L
        private val NSENTER_PREFIX = arrayOf("nsenter", "--target", "1", "--net", "--mount")
    }
}

/** In-memory [WgPeerManager] for tests. Tracks peers and persisted files without shelling out. */
class InMemoryWgPeerManager : WgPeerManager {
    val peers = mutableMapOf<UUID, Pair<String, String>>() // routerId → (publicKey, wgIp)
    val handshakes = mutableMapOf<String, Long>() // publicKey → epoch

    override suspend fun addPeer(routerId: UUID, publicKey: String, wgIp: String): AppResult<Unit> {
        peers[routerId] = publicKey to wgIp
        return AppResult.ok(Unit)
    }

    override suspend fun removePeer(routerId: UUID, publicKey: String): AppResult<Unit> {
        peers.remove(routerId)
        handshakes.remove(publicKey)
        return AppResult.ok(Unit)
    }

    override suspend fun listPeersWithHandshake(): AppResult<List<PeerHandshake>> =
        AppResult.ok(peers.values.map { (key, _) -> PeerHandshake(key, handshakes[key] ?: 0L) })
}
