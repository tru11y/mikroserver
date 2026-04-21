package com.mikroserver.infrastructure.wireguard

import com.mikroserver.shared.AppResult

/** Port: WireGuard peer management on the host network namespace. */
interface WireGuardController {

    /** Add a peer to the WireGuard interface. */
    suspend fun addPeer(
        interfaceName: String,
        publicKey: String,
        allowedIp: String,
    ): AppResult<Unit>

    /** Remove a peer by public key. */
    suspend fun removePeer(
        interfaceName: String,
        publicKey: String,
    ): AppResult<Unit>

    /** Save the current WireGuard configuration to persist across reboots. */
    suspend fun saveConfig(interfaceName: String): AppResult<Unit>

    /** Get the latest handshake time for a peer (epoch seconds, 0 if never). */
    suspend fun getLastHandshake(
        interfaceName: String,
        publicKey: String,
    ): AppResult<Long>
}
