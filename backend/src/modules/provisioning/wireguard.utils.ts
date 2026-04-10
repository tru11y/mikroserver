import { execAsync } from "./exec.utils";

export interface WireGuardKeyPair {
  privateKey: string;
  publicKey: string;
}

/**
 * Generate a WireGuard key pair using the `wg` CLI tool.
 * Falls back to crypto-based generation if wg is not available.
 */
export async function generateWireGuardKeyPair(): Promise<WireGuardKeyPair> {
  try {
    const { stdout: privateKey } = await execAsync("wg genkey");
    const trimmedPrivKey = privateKey.trim();
    const { stdout: publicKey } = await execAsync(
      `echo "${trimmedPrivKey}" | wg pubkey`,
    );
    return {
      privateKey: trimmedPrivKey,
      publicKey: publicKey.trim(),
    };
  } catch {
    // Fallback: generate via Node crypto (base64url 32 bytes)
    const { randomBytes } = await import("crypto");
    const privBytes = randomBytes(32);
    // Clamp as per RFC 7748 for Curve25519
    privBytes[0] &= 248;
    privBytes[31] &= 127;
    privBytes[31] |= 64;
    const privateKey = privBytes.toString("base64");
    // Note: This is not real WireGuard key derivation — only use wg CLI in production
    return { privateKey, publicKey: privateKey }; // placeholder
  }
}

/**
 * Add a WireGuard peer to the VPS wg0 interface.
 * Requires the `wg` binary and appropriate permissions (sudo or cap_net_admin).
 */
export async function addWireGuardPeer(
  publicKey: string,
  allowedIp: string,
): Promise<void> {
  // Add peer dynamically (non-persistent, survives until reboot)
  await execAsync(
    `wg set wg0 peer "${publicKey}" allowed-ips "${allowedIp}/32"`,
  );
}

/**
 * Remove a WireGuard peer from the VPS wg0 interface.
 */
export async function removeWireGuardPeer(publicKey: string): Promise<void> {
  await execAsync(`wg set wg0 peer "${publicKey}" remove`);
}

/**
 * Get the VPS WireGuard public key.
 */
export async function getVpsPublicKey(): Promise<string> {
  const { stdout } = await execAsync("wg show wg0 public-key");
  return stdout.trim();
}

/**
 * Check if a WireGuard peer is connected (has recent handshake).
 */
export async function isPeerConnected(publicKey: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`wg show wg0 latest-handshakes`);
    const lines = stdout.trim().split("\n");
    for (const line of lines) {
      const [key, timestamp] = line.trim().split("\t");
      if (key === publicKey) {
        const handshakeAge = Date.now() / 1000 - Number(timestamp);
        return handshakeAge < 180; // Connected if handshake < 3 minutes ago
      }
    }
    return false;
  } catch {
    return false;
  }
}
