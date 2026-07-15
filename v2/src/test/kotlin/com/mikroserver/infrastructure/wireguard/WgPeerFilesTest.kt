package com.mikroserver.infrastructure.wireguard

import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import org.junit.jupiter.api.Test
import java.util.UUID

class WgPeerFilesTest {

    private val routerId = UUID.fromString("11111111-2222-3333-4444-555555555555")

    @Test
    fun `peerConfPath is named by routerId under peers dir`() {
        WgPeerFiles.peerConfPath(routerId) shouldBe
            "/etc/wireguard/peers.d/11111111-2222-3333-4444-555555555555.conf"
    }

    @Test
    fun `peerConfContent is a single Peer stanza with a slash-32 allowed-ip`() {
        WgPeerFiles.peerConfContent("PUBKEY=", "10.66.66.150") shouldBe
            "[Peer]\nPublicKey = PUBKEY=\nAllowedIPs = 10.66.66.150/32\n"
    }

    @Test
    fun `parseDump skips the interface line and reads handshake epoch`() {
        // iface line, then two peers; field 4 (0-based) is the latest-handshake epoch.
        val dump = buildString {
            appendLine("SRVPRIV=\tSRVPUB=\t51820\toff")
            appendLine("PEER1=\t(none)\t203.0.113.1:51820\t10.66.66.10/32\t1700000000\t128\t256\t25")
            appendLine("PEER2=\t(none)\t(none)\t10.66.66.11/32\t0\t0\t0\toff")
        }
        val peers = WgPeerFiles.parseDump(dump)
        peers shouldHaveSize 2
        peers[0] shouldBe PeerHandshake("PEER1=", 1700000000L)
        peers[1] shouldBe PeerHandshake("PEER2=", 0L)
    }

    @Test
    fun `parseDump tolerates blank and malformed lines`() {
        val dump = "SRVPRIV=\tSRVPUB=\t51820\toff\n\nGARBAGE\nPEER=\tx\ty\tz\t42\t0\t0\toff\n"
        val peers = WgPeerFiles.parseDump(dump)
        peers shouldHaveSize 1
        peers[0] shouldBe PeerHandshake("PEER=", 42L)
    }
}
