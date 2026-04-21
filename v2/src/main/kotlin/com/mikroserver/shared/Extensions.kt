package com.mikroserver.shared

import java.security.SecureRandom

private val SECURE_RANDOM = SecureRandom()
private val VOUCHER_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O/1/I ambiguity

/** Generate a cryptographically random alphanumeric code of [length]. */
fun generateVoucherCode(length: Int = 8): String {
    val sb = StringBuilder(length)
    repeat(length) {
        sb.append(VOUCHER_CHARS[SECURE_RANDOM.nextInt(VOUCHER_CHARS.length)])
    }
    return sb.toString()
}

/** Generate a random hotspot password (alphanumeric, [length] chars). */
fun generateHotspotPassword(length: Int = 10): String {
    val chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    val sb = StringBuilder(length)
    repeat(length) {
        sb.append(chars[SECURE_RANDOM.nextInt(chars.length)])
    }
    return sb.toString()
}
