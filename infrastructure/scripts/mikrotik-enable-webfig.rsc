# Run on each MikroTik router via WinBox terminal or SSH
# Enables WebFig (www service) and allows access from the VPS via WireGuard
#
# IMPORTANT: WireGuard interface is named "wg-mks" (provisioned by MikroServer mobile app)
# Traffic arrives from 10.66.66.1 (VPS) after nginx TCP stream proxy + host NAT

# Enable www service on port 80, restrict to WireGuard subnet only
/ip service set www disabled=no port=80 address=10.66.66.0/24

# Allow access from wg-mks interface before any drop rules
/ip firewall filter add \
    chain=input \
    action=accept \
    protocol=tcp \
    dst-port=80 \
    in-interface=wg-mks \
    comment="WebFig via WireGuard (MikroServer)" \
    place-before=0

# Verify
/ip service print where name=www
/ip firewall filter print where comment~"WebFig"
