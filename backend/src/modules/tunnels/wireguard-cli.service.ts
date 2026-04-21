import { Injectable, Logger } from "@nestjs/common";
import { execFile } from "child_process";
import { promisify } from "util";
import { ConfigService } from "@nestjs/config";

const execFileAsync = promisify(execFile);

export interface WgPeerInfo {
  publicKey: string;
  lastHandshake: Date | null;
  allowedIp: string;
}

/**
 * Abstract interface for WireGuard CLI operations.
 * Concrete implementation wraps the `wg` binary; tests can mock this.
 */
export interface IWireguardCliService {
  addPeer(publicKey: string, allowedIp: string): Promise<void>;
  removePeer(publicKey: string): Promise<void>;
  listPeers(): Promise<WgPeerInfo[]>;
  getServerPublicKey(): Promise<string>;
}

@Injectable()
export class WireguardCliService implements IWireguardCliService {
  private readonly logger = new Logger(WireguardCliService.name);
  private readonly wgInterface: string;
  private cachedServerPubKey: string | null = null;

  constructor(private readonly config: ConfigService) {
    this.wgInterface = this.config.get<string>("WG_INTERFACE", "wg0");
  }

  /**
   * Run a wg command in the host network namespace (nsenter for Docker containers
   * with pid:host + NET_ADMIN). Falls back to direct execution on bare-metal.
   */
  private async wgExec(args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        "nsenter",
        ["-t", "1", "-n", "--", "wg", ...args],
        { timeout: 10_000 },
      );
      return stdout;
    } catch {
      const { stdout } = await execFileAsync("wg", args, { timeout: 10_000 });
      return stdout;
    }
  }

  async addPeer(publicKey: string, allowedIp: string): Promise<void> {
    await this.wgExec([
      "set",
      this.wgInterface,
      "peer",
      publicKey,
      "allowed-ips",
      allowedIp,
    ]);
    this.logger.log(`Peer added: ${publicKey.slice(0, 8)}… → ${allowedIp}`);
  }

  async removePeer(publicKey: string): Promise<void> {
    await this.wgExec(["set", this.wgInterface, "peer", publicKey, "remove"]);
    this.logger.log(`Peer removed: ${publicKey.slice(0, 8)}…`);
  }

  async listPeers(): Promise<WgPeerInfo[]> {
    const stdout = await this.wgExec(["show", this.wgInterface, "dump"]);
    const lines = stdout.trim().split("\n");
    // First line is the interface itself; skip it
    const peers: WgPeerInfo[] = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split("\t");
      // dump format: public_key  preshared_key  endpoint  allowed_ips  latest_handshake  transfer_rx  transfer_tx  persistent_keepalive
      if (parts.length < 5) continue;
      const pubKey = parts[0];
      const allowedIps = parts[3];
      const handshakeEpoch = Number(parts[4]);
      peers.push({
        publicKey: pubKey,
        allowedIp: allowedIps.split(",")[0]?.trim() ?? "",
        lastHandshake:
          handshakeEpoch > 0 ? new Date(handshakeEpoch * 1000) : null,
      });
    }
    return peers;
  }

  async getServerPublicKey(): Promise<string> {
    if (this.cachedServerPubKey) return this.cachedServerPubKey;
    const stdout = await this.wgExec(["show", this.wgInterface, "public-key"]);
    this.cachedServerPubKey = stdout.trim();
    return this.cachedServerPubKey;
  }
}
