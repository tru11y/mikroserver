import { Logger } from "@nestjs/common";
import { IMikroTikClient } from "../mikrotik-client/interfaces/mikrotik-client.interface";
import { ConfigureHotspotDto } from "./dto/configure-hotspot.dto";

export class HotspotAlreadyConfiguredException extends Error {
  constructor() {
    super("Un hotspot est déjà configuré sur ce routeur");
    this.name = "HotspotAlreadyConfiguredException";
  }
}

/**
 * Idempotent hotspot auto-configuration with rollback.
 * Replaces the interactive `/ip hotspot setup` CLI.
 */
export class HotspotSetupTransaction {
  private readonly undoStack: Array<{
    description: string;
    undo: () => Promise<void>;
  }> = [];
  private readonly logger = new Logger(HotspotSetupTransaction.name);

  constructor(
    private readonly client: IMikroTikClient,
    private readonly config: ConfigureHotspotDto,
  ) {}

  async execute(): Promise<void> {
    try {
      // Step 1: Preflight — no existing hotspot
      const existing = await this.client.list("/ip/hotspot");
      if (existing.length > 0) {
        throw new HotspotAlreadyConfiguredException();
      }

      // Step 2: IP address on hotspot interface
      await this.step("add IP address", async () => {
        const { ".id": id } = await this.client.add("/ip/address", {
          address: this.networkWithCidr(),
          interface: this.config.interfaceName,
          comment: "hsfl-hotspot",
        });
        this.pushUndo(`remove IP ${id}`, () =>
          this.client.remove("/ip/address", id),
        );
      });

      // Step 3: IP pool
      await this.step("create IP pool", async () => {
        const { ".id": id } = await this.client.add("/ip/pool", {
          name: "hsfl-pool",
          ranges: this.computePoolRange(),
        });
        this.pushUndo(`remove pool ${id}`, () =>
          this.client.remove("/ip/pool", id),
        );
      });

      // Step 4: DHCP server
      await this.step("create DHCP server", async () => {
        const { ".id": id } = await this.client.add("/ip/dhcp-server", {
          name: "hsfl-dhcp",
          interface: this.config.interfaceName,
          "address-pool": "hsfl-pool",
          "lease-time": "1h",
          disabled: "no",
        });
        this.pushUndo(`remove DHCP ${id}`, () =>
          this.client.remove("/ip/dhcp-server", id),
        );
      });

      // Step 5: DHCP network
      await this.step("create DHCP network", async () => {
        const { ".id": id } = await this.client.add("/ip/dhcp-server/network", {
          address: this.config.network,
          gateway: this.config.gateway,
          "dns-server": "8.8.8.8,1.1.1.1",
        });
        this.pushUndo(`remove DHCP network ${id}`, () =>
          this.client.remove("/ip/dhcp-server/network", id),
        );
      });

      // Step 6: Hotspot profile
      await this.step("create hotspot profile", async () => {
        const { ".id": id } = await this.client.add("/ip/hotspot/profile", {
          name: "hsfl-profile",
          "hotspot-address": this.config.gateway,
          "dns-name": this.config.dnsName ?? "",
          "html-directory": "hotspot",
          "login-by": "http-chap,http-pap,mac-cookie",
        });
        this.pushUndo(`remove profile ${id}`, () =>
          this.client.remove("/ip/hotspot/profile", id),
        );
      });

      // Step 7: Hotspot server
      await this.step("create hotspot server", async () => {
        const { ".id": id } = await this.client.add("/ip/hotspot", {
          name: "hsfl-hotspot",
          interface: this.config.interfaceName,
          "address-pool": "hsfl-pool",
          profile: "hsfl-profile",
          "idle-timeout": "5m",
          disabled: "no",
        });
        this.pushUndo(`remove hotspot ${id}`, () =>
          this.client.remove("/ip/hotspot", id),
        );
      });

      // Step 8: NAT masquerade
      await this.step("add NAT masquerade", async () => {
        const { ".id": id } = await this.client.add("/ip/firewall/nat", {
          chain: "srcnat",
          "src-address": this.config.network,
          action: "masquerade",
          comment: "hsfl-masquerade",
        });
        this.pushUndo(`remove NAT ${id}`, () =>
          this.client.remove("/ip/firewall/nat", id),
        );
      });

      // Step 9: Walled garden — Wave Money + captive portal detection
      const walledGardenHosts = [
        "*.wave.com",
        "*.wavemoney.io",
        "api.hotspotflow.ci",
        "captive.apple.com",
        "connectivitycheck.gstatic.com",
        "www.msftconnecttest.com",
      ];
      for (const host of walledGardenHosts) {
        await this.step(`walled garden: ${host}`, async () => {
          const { ".id": id } = await this.client.add(
            "/ip/hotspot/walled-garden",
            { action: "allow", "dst-host": host },
          );
          this.pushUndo(`remove walled garden ${id}`, () =>
            this.client.remove("/ip/hotspot/walled-garden", id),
          );
        });
      }
    } catch (err) {
      if (!(err instanceof HotspotAlreadyConfiguredException)) {
        this.logger.error(
          `Hotspot setup failed: ${err instanceof Error ? err.message : String(err)}. Rolling back...`,
        );
        await this.rollback();
      }
      throw err;
    }
  }

  private async step(
    description: string,
    action: () => Promise<void>,
  ): Promise<void> {
    this.logger.log(`Executing: ${description}`);
    await action();
  }

  private pushUndo(description: string, undo: () => Promise<void>): void {
    this.undoStack.push({ description, undo });
  }

  private async rollback(): Promise<void> {
    while (this.undoStack.length > 0) {
      const { description, undo } = this.undoStack.pop()!;
      try {
        await undo();
        this.logger.log(`Rolled back: ${description}`);
      } catch (err) {
        this.logger.warn(
          `Rollback failed for ${description}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  private networkWithCidr(): string {
    const mask = this.config.network.split("/")[1];
    return `${this.config.gateway}/${mask}`;
  }

  private computePoolRange(): string {
    if (this.config.poolStart && this.config.poolEnd) {
      return `${this.config.poolStart}-${this.config.poolEnd}`;
    }
    const network = this.config.network.split("/")[0];
    const parts = network.split(".");
    return `${parts[0]}.${parts[1]}.${parts[2]}.10-${parts[0]}.${parts[1]}.${parts[2]}.254`;
  }
}
