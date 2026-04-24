#!/usr/bin/env bash
# Run on VPS to open WebFig proxy ports (9002-9254) in UFW/iptables
# Router at 10.66.66.N is accessible at VPS port 9000+N via nginx stream
# N ranges from 2 to 254 → covers all 253 assignable WireGuard IPs

set -e

# UFW (Ubuntu/Debian)
if command -v ufw &>/dev/null; then
    ufw allow 9002:9254/tcp comment "WebFig proxy"
    ufw reload
    echo "UFW: ports 9002-9254 opened"
    exit 0
fi

# iptables fallback
iptables -I INPUT -p tcp --dport 9002:9254 -j ACCEPT
iptables-save > /etc/iptables/rules.v4
echo "iptables: ports 9002-9254 opened"
