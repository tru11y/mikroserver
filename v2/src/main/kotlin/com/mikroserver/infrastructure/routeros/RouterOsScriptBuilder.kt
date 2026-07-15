package com.mikroserver.infrastructure.routeros

import java.util.UUID

/**
 * Everything the RouterOS provisioning script needs. The [wgClientPrivateKey]
 * is EPHEMERAL: it appears only here (injected into the returned script) and is
 * never persisted nor logged.
 */
data class ProvisioningContext(
    val routerId: UUID,
    val wgServerPublicKey: String,
    val wgClientPrivateKey: String,
    val wgClientIp: String,
    val serverEndpointHost: String,
    val serverPort: Int,
    /** Backend URL the router POSTs its heartbeat to (auth via [heartbeatToken]). */
    val heartbeatUrl: String,
    val heartbeatToken: String,
)

/**
 * Builds the idempotent RouterOS script the mobile app runs on a fresh MikroTik
 * to bring up the permanent management tunnel to the VPS. Pure: same context in,
 * same script out (safe to snapshot-test).
 */
interface RouterOsScriptBuilder {
    fun build(ctx: ProvisioningContext): String
}

class DefaultRouterOsScriptBuilder : RouterOsScriptBuilder {

    override fun build(ctx: ProvisioningContext): String {
        val shortId = ctx.routerId.toString().take(SHORT_ID_LEN)
        return """
            # MikroServer provisioning — router ${ctx.routerId}
            # Auto-generated. Idempotent: safe to re-run. Do not edit by hand.

            # a. WireGuard interface (recreate to stay idempotent)
            :if ([/interface/wireguard/find name="$IFACE"] != "") do={ /interface/wireguard/remove [find name="$IFACE"] }
            /interface/wireguard/add name="$IFACE" private-key="${ctx.wgClientPrivateKey}" listen-port=$WG_LISTEN_PORT

            # b. Server peer (management subnet only, keepalive to punch NAT)
            :if ([/interface/wireguard/peers/find interface="$IFACE"] != "") do={ /interface/wireguard/peers/remove [find interface="$IFACE"] }
            /interface/wireguard/peers/add interface="$IFACE" public-key="${ctx.wgServerPublicKey}" endpoint-address=${ctx.serverEndpointHost} endpoint-port=${ctx.serverPort} allowed-address=$MGMT_SUBNET persistent-keepalive=25s

            # c. Client address on the tunnel
            :if ([/ip/address/find interface="$IFACE"] != "") do={ /ip/address/remove [find interface="$IFACE"] }
            /ip/address/add address=${ctx.wgClientIp}/24 interface="$IFACE"

            # d. No default route via the tunnel — management plane only, client traffic untouched.

            # e. Firewall: accept management from the VPS on API / Winbox / SSH
            /ip/firewall/filter/remove [find comment="$FW_COMMENT"]
            /ip/firewall/filter/add chain=input src-address=$VPS_MGMT_IP protocol=tcp dst-port=8728,8291,22 action=accept comment="$FW_COMMENT" place-before=0

            # f. Identity
            /system/identity/set name="MikroServer-$shortId"

            # g. Heartbeat every 5 minutes
            :if ([/system/scheduler/find name="$SCHED_NAME"] != "") do={ /system/scheduler/remove [find name="$SCHED_NAME"] }
            /system/scheduler/add name="$SCHED_NAME" interval=5m comment="mikroserver" on-event="/tool/fetch url=\"${ctx.heartbeatUrl}\" http-method=post http-header-field=\"Authorization: Bearer ${ctx.heartbeatToken}\" keep-result=no"

            # h. Hotspot setup — out of scope for this provisioning step.
        """.trimIndent() + "\n"
    }

    companion object {
        private const val IFACE = "wg-mikroserver"
        private const val WG_LISTEN_PORT = 51820
        private const val MGMT_SUBNET = "10.66.66.0/24"
        private const val VPS_MGMT_IP = "10.66.66.1"
        private const val FW_COMMENT = "mikroserver-mgmt"
        private const val SCHED_NAME = "mikroserver-heartbeat"
        private const val SHORT_ID_LEN = 8
    }
}
