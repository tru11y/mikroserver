# WireGuard Configuration

## Server Setup (Ubuntu VPS)

```bash
apt install wireguard

# Generate server keys
wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key

# /etc/wireguard/wg0.conf
[Interface]
PrivateKey = <SERVER_PRIVATE_KEY>
Address = 10.66.66.1/24
ListenPort = 51820
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# Add each MikroTik peer:
[Peer]
PublicKey = <MIKROTIK_PUBLIC_KEY>
AllowedIPs = 10.66.66.2/32  # Router 1
```

## MikroTik Setup (RouterOS)

```
/interface/wireguard/add name=wg-vps private-key=<MIKROTIK_PRIVATE_KEY> listen-port=13231
/interface/wireguard/peers/add interface=wg-vps public-key=<SERVER_PUBLIC_KEY> \
    endpoint-address=<VPS_IP> endpoint-port=51820 \
    allowed-address=10.66.66.0/24 persistent-keepalive=25
/ip/address/add address=10.66.66.2/24 interface=wg-vps
```

## IP Allocation

| Router | WireGuard IP |
|--------|-------------|
| Server | 10.66.66.1 |
| Router 1 (Centre) | 10.66.66.2 |
| Router 2 (Cocody) | 10.66.66.3 |
| Router N | 10.66.66.N |

## Security Notes

- All RouterOS API traffic flows through WireGuard tunnel (encrypted)
- API port 8728 must ONLY be accessible via WireGuard IP, not public internet
- Set RouterOS firewall: only allow API connections from 10.66.66.1
