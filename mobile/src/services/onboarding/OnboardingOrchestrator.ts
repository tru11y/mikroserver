import { MikroTikLanClient } from "../mikrotik-lan/MikroTikLanClient";
import { api, getApiBaseUrl } from "@/src/lib/api";

export interface OnboardingInput {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
  comment?: string;
}

export type OnboardingStepName =
  | "connect-lan"
  | "fetch-metadata"
  | "allocate-tunnel"
  | "configure-wireguard"
  | "create-agent-user"
  | "finalize-backend"
  | "install-beacon";

export interface OnboardingProgress {
  currentStep: OnboardingStepName;
  completedSteps: OnboardingStepName[];
  status: "running" | "success" | "error";
  error?: { step: OnboardingStepName; message: string };
}

export type AllocateTunnelResponse = {
  tunnelId: string;
  tunnelIp: string;
  clientPrivateKey: string;
  serverPublicKey: string;
  serverEndpoint: string;
};

/**
 * Orchestrates the 7-step zero-touch onboarding flow.
 * Runs entirely on the mobile app; backend provides tunnel allocation + finalization.
 */
export class OnboardingOrchestrator {
  private progress: OnboardingProgress = {
    currentStep: "connect-lan",
    completedSteps: [],
    status: "running",
  };
  private onProgress: (p: OnboardingProgress) => void = () => {};
  private rollbackStack: Array<{
    description: string;
    undo: () => Promise<void>;
  }> = [];

  constructor(private readonly lanClient: MikroTikLanClient) {}

  onProgressUpdate(cb: (p: OnboardingProgress) => void): void {
    this.onProgress = cb;
  }

  async run(input: OnboardingInput): Promise<{ routerId: string }> {
    try {
      // Step 1: LAN connection test
      this.setStep("connect-lan");
      await this.lanClient.systemResource();
      this.completeStep("connect-lan");

      // Step 2: Fetch metadata
      this.setStep("fetch-metadata");
      const [resource, identity, hotspots] = await Promise.all([
        this.lanClient.systemResource(),
        this.lanClient.systemIdentity(),
        this.lanClient.list<{ interface: string }>("/ip/hotspot"),
      ]);
      this.completeStep("fetch-metadata");

      // Step 3: Allocate tunnel from backend
      this.setStep("allocate-tunnel");
      const tunnel = await api.tunnels.allocate();
      this.rollbackStack.push({
        description: "revoke tunnel",
        undo: () => api.tunnels.remove(tunnel.tunnelId),
      });
      this.completeStep("allocate-tunnel");

      // Step 4: Configure WireGuard on the router
      this.setStep("configure-wireguard");
      await this.configureWireguard(tunnel);
      this.completeStep("configure-wireguard");

      // Step 5: Create dedicated API user (hsfl-agent)
      this.setStep("create-agent-user");
      const agentPassword = this.generateSecurePassword(32);
      await this.createAgentUser(agentPassword);
      this.completeStep("create-agent-user");

      // Step 6: Finalize with backend (get routerId)
      this.setStep("finalize-backend");
      const router = await api.routers.finalizeOnboarding({
        tunnelId: tunnel.tunnelId,
        name: input.name,
        comment: input.comment,
        agentUsername: "hsfl-agent",
        agentPassword,
        identity: identity.name,
        routerOsVersion: resource.version,
        boardName: resource["board-name"],
        architecture: resource["architecture-name"],
        hotspotAlreadyConfigured: hotspots.length > 0,
        hotspotInterface: hotspots[0]?.interface,
      });
      this.completeStep("finalize-backend");

      // Step 7: Install health beacon scheduler on router
      this.setStep("install-beacon");
      await this.installBeacon(router.id);
      this.completeStep("install-beacon");

      this.progress.status = "success";
      this.onProgress(this.progress);

      return { routerId: router.id };
    } catch (err) {
      this.progress.status = "error";
      this.progress.error = {
        step: this.progress.currentStep,
        message: err instanceof Error ? err.message : "Erreur inconnue",
      };
      this.onProgress(this.progress);
      await this.rollback();
      throw err;
    }
  }

  private async configureWireguard(tunnel: AllocateTunnelResponse): Promise<void> {
    const [endpointAddress, endpointPort] = tunnel.serverEndpoint.split(":");

    // a. Create WG interface
    const { ".id": wgId } = await this.lanClient.add(
      "/interface/wireguard",
      {
        name: "hsfl-wg",
        "listen-port": "51820",
        "private-key": tunnel.clientPrivateKey,
        comment: "HotspotFlow managed",
      },
    );
    this.rollbackStack.push({
      description: "remove wg interface",
      undo: () => this.lanClient.remove("/interface/wireguard", wgId),
    });

    // b. Assign IP
    const { ".id": ipId } = await this.lanClient.add("/ip/address", {
      address: `${tunnel.tunnelIp}/24`,
      interface: "hsfl-wg",
      comment: "HotspotFlow managed",
    });
    this.rollbackStack.push({
      description: "remove wg ip",
      undo: () => this.lanClient.remove("/ip/address", ipId),
    });

    // c. Add VPS peer
    const { ".id": peerId } = await this.lanClient.add(
      "/interface/wireguard/peers",
      {
        interface: "hsfl-wg",
        "public-key": tunnel.serverPublicKey,
        "endpoint-address": endpointAddress,
        "endpoint-port": endpointPort,
        "allowed-address": "10.66.66.0/24",
        "persistent-keepalive": "25s",
        comment: "HotspotFlow VPS",
      },
    );
    this.rollbackStack.push({
      description: "remove wg peer",
      undo: () =>
        this.lanClient.remove("/interface/wireguard/peers", peerId),
    });

    // d. Firewall: allow API access from tunnel
    const { ".id": fwId } = await this.lanClient.add(
      "/ip/firewall/filter",
      {
        chain: "input",
        "in-interface": "hsfl-wg",
        protocol: "tcp",
        "dst-port": "443,8729",
        action: "accept",
        "place-before": "0",
        comment: "HotspotFlow — allow API from tunnel",
      },
    );
    this.rollbackStack.push({
      description: "remove firewall rule",
      undo: () => this.lanClient.remove("/ip/firewall/filter", fwId),
    });

    // e. Enable REST and API-SSL services
    const services = await this.lanClient.list<{
      ".id": string;
      name: string;
      disabled: string;
    }>("/ip/service");
    for (const svc of services) {
      if (
        (svc.name === "www-ssl" || svc.name === "api-ssl") &&
        svc.disabled === "true"
      ) {
        await this.lanClient.set("/ip/service", svc[".id"], {
          disabled: "no",
        });
      }
    }
  }

  private async createAgentUser(password: string): Promise<void> {
    // Create group if not exists
    const groups = await this.lanClient.list<{
      ".id": string;
      name: string;
    }>("/user/group");
    let groupId = groups.find((g) => g.name === "hsfl-agent")?.[".id"];
    if (!groupId) {
      const res = await this.lanClient.add("/user/group", {
        name: "hsfl-agent",
        policy: "api,rest-api,read,write,test,policy,sensitive",
        comment: "HotspotFlow managed",
      });
      groupId = res[".id"];
      this.rollbackStack.push({
        description: "remove user group",
        undo: () => this.lanClient.remove("/user/group", groupId!),
      });
    }

    // Create or update user
    const users = await this.lanClient.list<{
      ".id": string;
      name: string;
    }>("/user");
    const existing = users.find((u) => u.name === "hsfl-agent");
    if (existing) {
      await this.lanClient.set("/user", existing[".id"], {
        password,
        group: "hsfl-agent",
      });
    } else {
      const res = await this.lanClient.add("/user", {
        name: "hsfl-agent",
        password,
        group: "hsfl-agent",
        comment: "HotspotFlow managed — do not delete",
      });
      this.rollbackStack.push({
        description: "remove hsfl-agent user",
        undo: () => this.lanClient.remove("/user", res[".id"]),
      });
    }
  }

  private async installBeacon(routerId: string): Promise<void> {
    const baseUrl = getApiBaseUrl();
    const beaconUrl = `${baseUrl}/beacon/${routerId}`;

    // Remove existing beacon (idempotent)
    const schedulers = await this.lanClient.list<{
      ".id": string;
      name: string;
    }>("/system/scheduler");
    const existing = schedulers.find((s) => s.name === "hsfl-beacon");
    if (existing) {
      await this.lanClient.remove("/system/scheduler", existing[".id"]);
    }

    await this.lanClient.add("/system/scheduler", {
      name: "hsfl-beacon",
      interval: "1m",
      "on-event": `/tool/fetch url="${beaconUrl}" mode=https http-method=post keep-result=no`,
      comment: "HotspotFlow — do not delete",
    });
  }

  private async rollback(): Promise<void> {
    while (this.rollbackStack.length > 0) {
      const { description, undo } = this.rollbackStack.pop()!;
      try {
        await undo();
      } catch {
        // best effort
      }
    }
  }

  private setStep(step: OnboardingStepName): void {
    this.progress.currentStep = step;
    this.onProgress(this.progress);
  }

  private completeStep(step: OnboardingStepName): void {
    this.progress.completedSteps.push(step);
    this.onProgress(this.progress);
  }

  private generateSecurePassword(length: number): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = new Uint8Array(length);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < length; i++)
        bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes)
      .map((b) => chars[b % chars.length])
      .join("");
  }
}
