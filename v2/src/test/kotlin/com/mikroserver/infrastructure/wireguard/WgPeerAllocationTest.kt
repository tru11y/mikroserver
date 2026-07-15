package com.mikroserver.infrastructure.wireguard

import io.kotest.matchers.shouldBe
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Test

class WgPeerAllocationTest {

    @Test
    fun `InMemoryWireGuardController tracks peers correctly`() = runTest {
        val wg = InMemoryWireGuardController()
        wg.addPeer("wg0", "pubkey1", "10.66.66.2")
        wg.addPeer("wg0", "pubkey2", "10.66.66.3")

        wg.peers.size shouldBe 2
        wg.peers["pubkey1"] shouldBe "10.66.66.2"

        wg.removePeer("wg0", "pubkey1")
        wg.peers.size shouldBe 1
    }

    @Test
    fun `InMemoryWireGuardController saveConfig records interface`() = runTest {
        val wg = InMemoryWireGuardController()
        wg.saveConfig("wg0")
        wg.saveConfig("wg0")
        wg.savedConfigs.size shouldBe 2
    }
}
