import { generateKeyPairSync } from "crypto";
import { execAsync } from "./exec.utils";

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
 * Uses nsenter to run in the host network namespace from inside Docker.
 */
export async function addWireGuardPeer(
  publicKey: string,
  allowedIp: string,
): Promise<void> {
  await wgExec(`wg set wg0 peer "${publicKey}" allowed-ips "${allowedIp}/32"`);
}

/**
 * Remove a WireGuard peer from the VPS wg0 interface.
 */
export async function removeWireGuardPeer(publicKey: string): Promise<void> {
  await wgExec(`wg set wg0 peer "${publicKey}" remove`);
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
  try {
    const stdout = await wgExec("wg show wg0 latest-handshakes");
    for (const line of stdout.trim().split("\n")) {
      const [key, timestamp] = line.trim().split("\t");
      if (key === publicKey) {
        const handshakeAge = Date.now() / 1000 - Number(timestamp);
        return handshakeAge < 180;
      }
    }
    return false;
  } catch {
    return false;
  }
}
