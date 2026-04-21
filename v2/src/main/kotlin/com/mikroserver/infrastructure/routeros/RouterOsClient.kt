package com.mikroserver.infrastructure.routeros

import com.mikroserver.shared.AppResult

/** Port: RouterOS API operations over port 8728. */
interface RouterOsClient {

    /** Login to a router at [host]:[port]. */
    suspend fun login(host: String, port: Int, username: String, password: String): AppResult<Unit>

    /** Add a hotspot user with rate-limit. */
    suspend fun addHotspotUser(
        host: String,
        port: Int,
        username: String,
        password: String,
        routerUser: String,
        routerPass: String,
        hotspotUsername: String,
        hotspotPassword: String,
        rateLimit: String?,
        uptimeLimit: String?,
    ): AppResult<String>

    /** Remove a hotspot user by name. */
    suspend fun removeHotspotUser(
        host: String,
        port: Int,
        username: String,
        password: String,
        routerUser: String,
        routerPass: String,
        hotspotUsername: String,
    ): AppResult<Unit>

    /** List active hotspot sessions. */
    suspend fun getActiveHotspotSessions(
        host: String,
        port: Int,
        username: String,
        password: String,
    ): AppResult<List<HotspotActiveSession>>
}

data class HotspotActiveSession(
    val id: String,
    val user: String,
    val macAddress: String,
    val ipAddress: String?,
    val uptime: String,
    val bytesIn: Long,
    val bytesOut: Long,
)
