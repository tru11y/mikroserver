package com.mikroserver.infrastructure.routeros

import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import org.junit.jupiter.api.Test
import java.util.UUID

class RouterOsScriptBuilderTest {

    private val builder = DefaultRouterOsScriptBuilder()

    private val ctx = ProvisioningContext(
        routerId = UUID.fromString("11111111-2222-3333-4444-555555555555"),
        wgServerPublicKey = "SERVERPUBKEYbase64AAAAAAAAAAAAAAAAAAAAAAAAA=",
        wgClientPrivateKey = "CLIENTPRIVKEYbase64BBBBBBBBBBBBBBBBBBBBBBBB=",
        wgClientIp = "10.66.66.150",
        serverEndpointHost = "203.0.113.10",
        serverPort = 51820,
        heartbeatUrl = "https://api.mikroserver.ci/api/v1/routers/heartbeat",
        heartbeatToken = "hb-token-abc",
    )

    @Test
    fun `builds all required sections`() {
        val s = builder.build(ctx)
        s shouldContain """/interface/wireguard/add name="wg-mikroserver" private-key="${ctx.wgClientPrivateKey}""""
        s shouldContain """public-key="${ctx.wgServerPublicKey}""""
        s shouldContain "endpoint-address=203.0.113.10 endpoint-port=51820"
        s shouldContain "allowed-address=10.66.66.0/24 persistent-keepalive=25s"
        s shouldContain "/ip/address/add address=10.66.66.150/24 interface=\"wg-mikroserver\""
        s shouldContain "src-address=10.66.66.1 protocol=tcp dst-port=8728,8291,22 action=accept"
        s shouldContain """/system/identity/set name="MikroServer-11111111""""
        s shouldContain "interval=5m"
        s shouldContain ctx.heartbeatUrl
        s shouldContain "Authorization: Bearer ${ctx.heartbeatToken}"
    }

    @Test
    fun `is idempotent — every add is guarded by a remove`() {
        val s = builder.build(ctx)
        s shouldContain "/interface/wireguard/remove [find name=\"wg-mikroserver\"]"
        s shouldContain "/interface/wireguard/peers/remove [find interface=\"wg-mikroserver\"]"
        s shouldContain "/ip/address/remove [find interface=\"wg-mikroserver\"]"
        s shouldContain "/ip/firewall/filter/remove [find comment=\"mikroserver-mgmt\"]"
        s shouldContain "/system/scheduler/remove [find name=\"mikroserver-heartbeat\"]"
    }

    @Test
    fun `does not route client traffic through the tunnel`() {
        val s = builder.build(ctx)
        s shouldNotContain "0.0.0.0/0"
        s shouldNotContain "/ip/route/add"
    }

    @Test
    fun `is deterministic`() {
        builder.build(ctx) shouldBe builder.build(ctx)
    }

    @Test
    fun `emits the private key exactly once`() {
        val s = builder.build(ctx)
        val occurrences = s.split(ctx.wgClientPrivateKey).size - 1
        occurrences shouldBe 1
    }
}
