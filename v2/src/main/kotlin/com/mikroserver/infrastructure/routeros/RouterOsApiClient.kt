package com.mikroserver.infrastructure.routeros

import com.mikroserver.shared.AppError
import com.mikroserver.shared.AppResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.slf4j.LoggerFactory
import java.io.DataInputStream
import java.io.DataOutputStream
import java.net.Socket

/**
 * Native Kotlin implementation of MikroTik RouterOS API binary protocol (port 8728).
 * Each "sentence" is a sequence of length-prefixed "words", terminated by a zero-length word.
 */
class RouterOsApiClient : RouterOsClient {

    private val log = LoggerFactory.getLogger(RouterOsApiClient::class.java)

    override suspend fun login(
        host: String,
        port: Int,
        username: String,
        password: String,
    ): AppResult<Unit> = executeCommand(host, port, username, password) {
        // login is handled by executeCommand's connect phase
        AppResult.ok(Unit)
    }

    override suspend fun addHotspotUser(
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
    ): AppResult<String> = executeCommand(host, port, routerUser, routerPass) { conn ->
        val words = mutableListOf(
            "/ip/hotspot/user/add",
            "=name=$hotspotUsername",
            "=password=$hotspotPassword",
            "=server=all",
        )
        if (rateLimit != null) words.add("=limit-uptime=$uptimeLimit")
        if (rateLimit != null) words.add("=rate-limit=$rateLimit")

        conn.writeSentence(words)
        val reply = conn.readSentence()
        if (reply.firstOrNull()?.startsWith("!done") == true) {
            val ret = reply.firstOrNull { it.startsWith("=ret=") }?.removePrefix("=ret=") ?: ""
            AppResult.ok(ret)
        } else {
            val msg = reply.firstOrNull { it.startsWith("=message=") }?.removePrefix("=message=") ?: "Unknown error"
            AppResult.err(AppError.ExternalServiceError("RouterOS", msg))
        }
    }

    override suspend fun removeHotspotUser(
        host: String,
        port: Int,
        username: String,
        password: String,
        routerUser: String,
        routerPass: String,
        hotspotUsername: String,
    ): AppResult<Unit> = executeCommand(host, port, routerUser, routerPass) { conn ->
        // Find user ID first
        conn.writeSentence(listOf("/ip/hotspot/user/print", "?name=$hotspotUsername"))
        val printReply = conn.readSentence()
        val idWord = printReply.firstOrNull { it.startsWith("=.id=") }?.removePrefix("=.id=")
            ?: return@executeCommand AppResult.err(AppError.NotFound("hotspot-user", hotspotUsername))

        conn.writeSentence(listOf("/ip/hotspot/user/remove", "=.id=$idWord"))
        val removeReply = conn.readSentence()
        if (removeReply.firstOrNull()?.startsWith("!done") == true) {
            AppResult.ok(Unit)
        } else {
            val msg = removeReply.firstOrNull { it.startsWith("=message=") }?.removePrefix("=message=") ?: "Unknown"
            AppResult.err(AppError.ExternalServiceError("RouterOS", msg))
        }
    }

    override suspend fun getActiveHotspotSessions(
        host: String,
        port: Int,
        username: String,
        password: String,
    ): AppResult<List<HotspotActiveSession>> = executeCommand(host, port, username, password) { conn ->
        conn.writeSentence(listOf("/ip/hotspot/active/print"))
        val reply = conn.readAllReplies()

        val sessions = reply
            .filter { it.firstOrNull()?.startsWith("!re") == true }
            .map { words ->
                val attrs = words.filter { it.startsWith("=") }
                    .associate {
                        val eq = it.indexOf('=', 1)
                        it.substring(1, eq) to it.substring(eq + 1)
                    }
                HotspotActiveSession(
                    id = attrs[".id"].orEmpty(),
                    user = attrs["user"].orEmpty(),
                    macAddress = attrs["mac-address"].orEmpty(),
                    ipAddress = attrs["address"],
                    uptime = attrs["uptime"].orEmpty(),
                    bytesIn = attrs["bytes-in"]?.toLongOrNull() ?: 0L,
                    bytesOut = attrs["bytes-out"]?.toLongOrNull() ?: 0L,
                )
            }
        AppResult.ok(sessions)
    }

    // ── Protocol implementation ──────────────────────────────────────────────

    private suspend fun <T> executeCommand(
        host: String,
        port: Int,
        username: String,
        password: String,
        block: suspend (ApiConnection) -> AppResult<T>,
    ): AppResult<T> = withContext(Dispatchers.IO) {
        try {
            val socket = Socket(host, port).apply { soTimeout = 10_000 }
            val conn = ApiConnection(
                input = DataInputStream(socket.getInputStream()),
                output = DataOutputStream(socket.getOutputStream()),
            )
            // Login
            conn.writeSentence(listOf("/login", "=name=$username", "=password=$password"))
            val loginReply = conn.readSentence()
            if (loginReply.firstOrNull()?.startsWith("!done") != true) {
                socket.close()
                val msg = loginReply.firstOrNull { it.startsWith("=message=") }?.removePrefix("=message=")
                    ?: "Login failed"
                return@withContext AppResult.err(AppError.ExternalServiceError("RouterOS", msg))
            }

            val result = block(conn)
            socket.close()
            result
        } catch (e: Exception) {
            log.error("RouterOS API error for {}:{} — {}", host, port, e.message)
            AppResult.err(AppError.ExternalServiceError("RouterOS", e.message ?: "Connection failed"))
        }
    }

    class ApiConnection(
        private val input: DataInputStream,
        private val output: DataOutputStream,
    ) {
        fun writeSentence(words: List<String>) {
            for (word in words) {
                writeWord(word)
            }
            writeWord("") // end-of-sentence
            output.flush()
        }

        fun readSentence(): List<String> {
            val words = mutableListOf<String>()
            while (true) {
                val word = readWord()
                if (word.isEmpty()) break
                words.add(word)
            }
            return words
        }

        fun readAllReplies(): List<List<String>> {
            val replies = mutableListOf<List<String>>()
            while (true) {
                val sentence = readSentence()
                if (sentence.isEmpty()) continue
                replies.add(sentence)
                if (sentence.first().startsWith("!done") || sentence.first().startsWith("!trap")) break
            }
            return replies
        }

        private fun writeWord(word: String) {
            val bytes = word.toByteArray(Charsets.UTF_8)
            writeLength(bytes.size)
            output.write(bytes)
        }

        private fun readWord(): String {
            val len = readLength()
            if (len == 0) return ""
            val buf = ByteArray(len)
            input.readFully(buf)
            return String(buf, Charsets.UTF_8)
        }

        /** MikroTik API word-length encoding. */
        private fun writeLength(len: Int) {
            when {
                len < 0x80 -> output.writeByte(len)
                len < 0x4000 -> {
                    output.writeByte((len shr 8) or 0x80)
                    output.writeByte(len and 0xFF)
                }
                len < 0x200000 -> {
                    output.writeByte((len shr 16) or 0xC0)
                    output.writeByte((len shr 8) and 0xFF)
                    output.writeByte(len and 0xFF)
                }
                len < 0x10000000 -> {
                    output.writeByte((len shr 24) or 0xE0)
                    output.writeByte((len shr 16) and 0xFF)
                    output.writeByte((len shr 8) and 0xFF)
                    output.writeByte(len and 0xFF)
                }
                else -> {
                    output.writeByte(0xF0)
                    output.writeInt(len)
                }
            }
        }

        /** MikroTik API word-length decoding. */
        private fun readLength(): Int {
            val first = input.readUnsignedByte()
            return when {
                first < 0x80 -> first
                first < 0xC0 -> ((first and 0x3F) shl 8) or input.readUnsignedByte()
                first < 0xE0 -> {
                    ((first and 0x1F) shl 16) or
                        (input.readUnsignedByte() shl 8) or
                        input.readUnsignedByte()
                }
                first < 0xF0 -> {
                    ((first and 0x0F) shl 24) or
                        (input.readUnsignedByte() shl 16) or
                        (input.readUnsignedByte() shl 8) or
                        input.readUnsignedByte()
                }
                else -> input.readInt()
            }
        }
    }
}
