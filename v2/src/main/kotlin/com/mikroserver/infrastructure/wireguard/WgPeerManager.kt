package com.mikroserver.infrastructure.wireguard

import com.mikroserver.shared.AppResult
import java.util.UUID

/** Latest handshake age for a WG peer, as reported by `wg show <iface> dump`. */
data class PeerHandshake(
    val publicKey: String,
    val latestHandshakeEpoch: Long,
)

/**
 * Manages WireGuard peers on the host wg0 interface.
 *
 * Persistence strategy: peers are applied live via `wg set` AND written to
 * `/etc/wireguard/peers.d/<routerId>.conf` so they survive a reboot (re-loaded
 * by `reload-peers.sh` from wg0.conf's PostUp). The server's wg0.conf holds only
 * the [Interface] section.
 */
interface WgPeerManager {

    /** Add/replace the peer live and persist its peers.d file. */
    suspend fun addPeer(routerId: UUID, publicKey: String, wgIp: String): AppResult<Unit>

    /** Remove the peer live and delete its peers.d file. */
    suspend fun removePeer(routerId: UUID, publicKey: String): AppResult<Unit>

    /** Parse `wg show <iface> dump` to get the latest handshake per peer. */
    suspend fun listPeersWithHandshake(): AppResult<List<PeerHandshake>>
}

/** Pure helpers for the WG peers.d strategy — kept side-effect free for unit tests. */
object WgPeerFiles {

    const val PEERS_DIR = "/etc/wireguard/peers.d"

    fun peerConfPath(routerId: UUID): String = "$PEERS_DIR/$routerId.conf"

    /** Content of a peers.d/<routerId>.conf file (a single [Peer] stanza). */
    fun peerConfContent(publicKey: String, wgIp: String): String =
        """
        [Peer]
        PublicKey = $publicKey
        AllowedIPs = $wgIp/32
        """.trimIndent() + "\n"

    /**
     * Parse `wg show <iface> dump`. First line is the interface; each following
     * tab-separated line is a peer whose field 4 (0-based) is the latest
     * handshake epoch (0 = never).
     */
    fun parseDump(dump: String): List<PeerHandshake> =
        dump.lineSequence()
            .drop(1) // interface line
            .filter { it.isNotBlank() }
            .mapNotNull { line ->
                val f = line.split("\t")
                if (f.size < 5) {
                    null
                } else {
                    PeerHandshake(publicKey = f[0].trim(), latestHandshakeEpoch = f[4].trim().toLongOrNull() ?: 0L)
                }
            }
            .toList()
}
