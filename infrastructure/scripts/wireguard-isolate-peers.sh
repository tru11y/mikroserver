#!/usr/bin/env bash
# =============================================================================
# wireguard-isolate-peers.sh
#
# PURPOSE: Drop direct WireGuard peer-to-peer traffic so routers can only
#          reach the VPS hub (10.66.66.1), not each other.
#
# ARCHITECTURE: Hub-and-spoke. VPS=10.66.66.1, Routers=10.66.66.2+
#
# RUN: Once after VPS boot (or via rc.local / systemd).
#      The rules are NOT persistent across reboots — add to /etc/rc.local
#      or a systemd service for persistence.
#
# SAFE TO RE-RUN: Each iptables -I checks position 1 so duplicates are
#                 possible — run via systemd with RemainAfterExit=yes instead.
# =============================================================================

set -euo pipefail

WG_IFACE="wg0"
WG_SUBNET="10.66.66.0/24"
VPS_IP="10.66.66.1"

echo "[wireguard-isolate] Applying inter-peer DROP rules on $WG_IFACE ..."

# Allow traffic FROM routers TO the VPS hub (10.66.66.1)
iptables -I FORWARD -i "$WG_IFACE" -o "$WG_IFACE" -d "$VPS_IP" -j ACCEPT

# Allow traffic FROM the VPS hub TO any router (return/initiated traffic)
iptables -I FORWARD -i "$WG_IFACE" -o "$WG_IFACE" -s "$VPS_IP" -j ACCEPT

# Drop all other intra-WireGuard forwarding (router→router)
iptables -I FORWARD -i "$WG_IFACE" -o "$WG_IFACE" -s "$WG_SUBNET" -d "$WG_SUBNET" -j DROP

echo "[wireguard-isolate] Done. Routers can reach VPS only."
echo ""
echo "To persist across reboots, add to /etc/rc.local or a systemd service:"
echo "  ExecStart=/path/to/wireguard-isolate-peers.sh"
echo "  RemainAfterExit=yes"
