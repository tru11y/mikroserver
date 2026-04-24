import { generateKeyPairSync } from "crypto";
import { execAsync } from "./exec.utils";

/** WireGuard handshake is considered stale after this many seconds. */
export const HANDSHAKE_VALID_SECONDS = 180;

export interface WireGuardKeyPair {
  privateKey: string;
  publicKey: string;
}

/**
 * Run a wg command in the host network namespace (works from inside Docker
 * when container has `pid: host` and `cap_add: [NET_ADMIN, SYS_ADMIN]`).
 * Falls back to running directly (for host-mode or bare-metal deployments).
 */
async function wgExec(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`nsenter -t 1 -n -- ${cmd}`);
    return stdout;
  } catch {
    const { stdout } = await execAsync(cmd);
    return stdout;
  }
}

/**
 * Generate a WireGuard key pair using Node.js built-in X25519 crypto.
 * No dependency on the `wg` CLI — works inside Docker containers.
 */
export async function generateWireGuardKeyPair(): Promise<WireGuardKeyPair> {
  const { privateKey: privDer, publicKey: pubDer } = generateKeyPairSync(
    "x25519",
    {
      privateKeyEncoding: { type: "pkcs8", format: "der" },
      publicKeyEncoding: { type: "spki", format: "der" },
    },
  );
  // PKCS8 DER for x25519: raw 32-byte key starts at offset 16
  // SPKI DER for x25519: raw 32-byte key starts at offset 12
  const privateKey = (privDer as Buffer).subarray(16).toString("base64");
  const publicKey = (pubDer as Buffer).subarray(12).toString("base64");
  return { privateKey, publicKey };
}

/**
 * Add a WireGuard peer to the VPS wg0 interface.
 * Persists the updated peer list to /etc/wireguard/wg0.conf after success
 * so peers survive a VPS reboot or wg-quick restart.
 * Persistence failure is non-fatal — the dynamic peer is still live.
 */
export async function addWireGuardPeer(
  publicKey: string,
  allowedIp: string,
): Promise<void> {
  await wgExec(`wg set wg0 peer "${publicKey}" allowed-ips "${allowedIp}/32"`);
  await persistPeersToDisk().catch(() => {
    // Non-fatal: live peer is active. Peer will be lost on next wg-quick restart
    // but the provisioning cron will detect and re-add it.
  });
}

/**
 * Remove a WireGuard peer from the VPS wg0 interface.
 * Persists the updated peer list to wg0.conf after removal.
 */
export async function removeWireGuardPeer(publicKey: string): Promise<void> {
  await wgExec(`wg set wg0 peer "${publicKey}" remove`);
  await persistPeersToDisk().catch(() => {});
}

/**
 * Get the VPS WireGuard public key.
 */
export async function getVpsPublicKey(): Promise<string> {
  return (await wgExec("wg show wg0 public-key")).trim();
}

/**
 * Check if a WireGuard peer is connected (has recent handshake).
 */
export async function isPeerConnected(publicKey: string): Promise<boolean> {
  const age = await getPeerHandshakeAge(publicKey);
  return age !== null && age < HANDSHAKE_VALID_SECONDS;
}

/**
 * Return the age of a peer's last handshake in seconds, or null if the peer
 * is not found / has never completed a handshake (timestamp=0).
 *
 * Parses `wg show wg0 latest-handshakes` output:
 *   <base64-pubkey>\t<unix-timestamp>
 * A timestamp of 0 means WireGuard has never seen a handshake from this peer.
 */
export async function getPeerHandshakeAge(
  publicKey: string,
): Promise<number | null> {
  try {
    const stdout = await wgExec("wg show wg0 latest-handshakes");
    for (const line of stdout.trim().split("\n")) {
      const [key, timestamp] = line.trim().split("\t");
      if (key !== publicKey) continue;
      const ts = Number(timestamp);
      if (!ts) return null; // timestamp=0 → never handshaked
      const age = Date.now() / 1000 - ts;
      return Math.round(age);
    }
    return null; // peer not found in wg show output
  } catch {
    return null;
  }
}

/**
 * Persist current live peer state to /etc/wireguard/wg0.conf so that peers
 * survive `wg-quick down/up` or a VPS reboot.
 *
 * Uses `wg showconf wg0` which dumps the CURRENT kernel state (including all
 * dynamically-added peers) in wg-quick format.  Writing it atomically via a
 * temp file prevents a partial write from corrupting the config.
 *
 * Called after every addWireGuardPeer / removeWireGuardPeer.
 * Failure is non-fatal: dynamic peers still work until next reboot.
 */
export async function persistPeersToDisk(): Promise<void> {
  const tmpPath = "/etc/wireguard/wg0.conf.tmp";
  const finalPath = "/etc/wireguard/wg0.conf";
  const lockPath = "/etc/wireguard/wg0.conf.lock";
  // flock prevents concurrent writers from interleaving their showconf snapshots.
  // mv is POSIX-atomic on same filesystem — readers never see a partial file.
  await wgExec(
    `flock -x ${lockPath} sh -c 'wg showconf wg0 > ${tmpPath} && mv -f ${tmpPath} ${finalPath}'`,
  );
}
