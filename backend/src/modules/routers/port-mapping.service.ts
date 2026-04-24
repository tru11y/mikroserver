import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common";
import { exec } from "child_process";
import { promisify } from "util";
import * as net from "net";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import type { RouterPortMap } from "@prisma/client";

const execAsync = promisify(exec);

@Injectable()
export class PortMappingService {
  private readonly logger = new Logger(PortMappingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // ── helpers ───────────────────────────────────────────────────────────────

  private get vpsPublicIp(): string {
    return this.configService.get<string>("VPS_PUBLIC_IP") ?? "127.0.0.1";
  }

  private get rangeStart(): number {
    return Number(
      this.configService.get<string>("PORT_MAP_RANGE_START") ?? 19000,
    );
  }

  private get rangeEnd(): number {
    return Number(
      this.configService.get<string>("PORT_MAP_RANGE_END") ?? 19999,
    );
  }

  /** Find 3 consecutive unused ports in [rangeStart, rangeEnd] */
  private async allocateThreePorts(): Promise<[number, number, number]> {
    const used = await this.prisma.routerPortMap.findMany({
      select: {
        publicWebfigPort: true,
        publicWinboxPort: true,
        publicSshPort: true,
      },
    });
    const usedSet = new Set<number>();
    for (const pm of used) {
      usedSet.add(pm.publicWebfigPort);
      usedSet.add(pm.publicWinboxPort);
      usedSet.add(pm.publicSshPort);
    }

    const free: number[] = [];
    for (let p = this.rangeStart; p <= this.rangeEnd && free.length < 3; p++) {
      if (!usedSet.has(p)) free.push(p);
    }

    if (free.length < 3) {
      throw new InternalServerErrorException(
        "Port pool exhausted — no 3 free ports in range",
      );
    }
    return [free[0], free[1], free[2]];
  }

  private async sh(cmd: string): Promise<void> {
    // Run in host network namespace via nsenter (container has pid:host + privileged).
    // Falls back to direct execution when running outside Docker (e.g. tests).
    const wrapped = "nsenter -t 1 -n -m -- " + cmd;
    const { stderr } = await execAsync(wrapped).catch(() => execAsync(cmd));
    if (stderr) this.logger.warn(`iptables stderr: ${stderr}`);
  }

  /** Delete an iptables rule, ignoring "not found" errors (idempotent). */
  private async shDel(cmd: string): Promise<void> {
    const wrapped = "nsenter -t 1 -n -m -- " + cmd;
    await execAsync(wrapped)
      .catch(() => execAsync(cmd))
      .catch(() => null);
  }

  // ── allocatePortsForRouter ────────────────────────────────────────────────

  async allocatePortsForRouter(
    routerId: string,
    vpnIp: string,
  ): Promise<RouterPortMap> {
    const existing = await this.prisma.routerPortMap.findUnique({
      where: { routerId },
    });
    if (existing) {
      throw new ConflictException(
        "Un port map existe déjà pour ce routeur — supprimez-le d'abord",
      );
    }

    const [webfig, winbox, ssh] = await this.allocateThreePorts();

    const portMap = await this.prisma.routerPortMap.create({
      data: {
        routerId,
        vpnIp,
        publicWebfigPort: webfig,
        publicWinboxPort: winbox,
        publicSshPort: ssh,
        rulesActive: false,
      },
    });

    try {
      await this.applyIptablesRules(portMap);
    } catch (err) {
      this.logger.error(`iptables apply failed for router ${routerId}: ${err}`);
      // portMap is in DB but rules not active — caller will see rulesActive=false
    }

    return this.prisma.routerPortMap.findUniqueOrThrow({ where: { routerId } });
  }

  // ── applyIptablesRules ────────────────────────────────────────────────────

  async applyIptablesRules(portMap: RouterPortMap): Promise<void> {
    const { vpnIp, publicWebfigPort, publicWinboxPort, publicSshPort } =
      portMap;

    try {
      // Enable IP forwarding
      await this.sh("sysctl -w net.ipv4.ip_forward=1");

      // Remove existing rules first (idempotent — tolerates missing rules)
      await this.shDel(
        `iptables -t nat -D PREROUTING -p tcp --dport ${publicWebfigPort} -j DNAT --to-destination ${vpnIp}:80`,
      );
      await this.shDel(
        `iptables -t nat -D POSTROUTING -p tcp -d ${vpnIp} --dport 80 -j MASQUERADE`,
      );
      await this.shDel(
        `iptables -t nat -D PREROUTING -p tcp --dport ${publicWinboxPort} -j DNAT --to-destination ${vpnIp}:8291`,
      );
      await this.shDel(
        `iptables -t nat -D POSTROUTING -p tcp -d ${vpnIp} --dport 8291 -j MASQUERADE`,
      );
      await this.shDel(
        `iptables -t nat -D PREROUTING -p tcp --dport ${publicSshPort} -j DNAT --to-destination ${vpnIp}:22`,
      );
      await this.shDel(
        `iptables -t nat -D POSTROUTING -p tcp -d ${vpnIp} --dport 22 -j MASQUERADE`,
      );

      // WebFig: VPS:publicWebfigPort → vpnIp:80
      await this.sh(
        `iptables -t nat -A PREROUTING -p tcp --dport ${publicWebfigPort} -j DNAT --to-destination ${vpnIp}:80`,
      );
      await this.sh(
        `iptables -t nat -A POSTROUTING -p tcp -d ${vpnIp} --dport 80 -j MASQUERADE`,
      );

      // Winbox: VPS:publicWinboxPort → vpnIp:8291
      await this.sh(
        `iptables -t nat -A PREROUTING -p tcp --dport ${publicWinboxPort} -j DNAT --to-destination ${vpnIp}:8291`,
      );
      await this.sh(
        `iptables -t nat -A POSTROUTING -p tcp -d ${vpnIp} --dport 8291 -j MASQUERADE`,
      );

      // SSH: VPS:publicSshPort → vpnIp:22
      await this.sh(
        `iptables -t nat -A PREROUTING -p tcp --dport ${publicSshPort} -j DNAT --to-destination ${vpnIp}:22`,
      );
      await this.sh(
        `iptables -t nat -A POSTROUTING -p tcp -d ${vpnIp} --dport 22 -j MASQUERADE`,
      );

      await this.prisma.routerPortMap.update({
        where: { id: portMap.id },
        data: { rulesActive: true },
      });

      this.logger.log(
        `iptables rules applied for ${vpnIp} (webfig:${publicWebfigPort} winbox:${publicWinboxPort} ssh:${publicSshPort})`,
      );
    } catch (err) {
      await this.prisma.routerPortMap
        .update({
          where: { id: portMap.id },
          data: { rulesActive: false },
        })
        .catch(() => null);
      throw new InternalServerErrorException(
        `Échec application règles iptables: ${(err as Error).message}`,
      );
    }
  }

  // ── removeIptablesRules ───────────────────────────────────────────────────

  async removeIptablesRules(portMap: RouterPortMap): Promise<void> {
    const { vpnIp, publicWebfigPort, publicWinboxPort, publicSshPort } =
      portMap;

    const cmds = [
      `iptables -t nat -D PREROUTING -p tcp --dport ${publicWebfigPort} -j DNAT --to-destination ${vpnIp}:80`,
      `iptables -t nat -D POSTROUTING -p tcp -d ${vpnIp} --dport 80 -j MASQUERADE`,
      `iptables -t nat -D PREROUTING -p tcp --dport ${publicWinboxPort} -j DNAT --to-destination ${vpnIp}:8291`,
      `iptables -t nat -D POSTROUTING -p tcp -d ${vpnIp} --dport 8291 -j MASQUERADE`,
      `iptables -t nat -D PREROUTING -p tcp --dport ${publicSshPort} -j DNAT --to-destination ${vpnIp}:22`,
      `iptables -t nat -D POSTROUTING -p tcp -d ${vpnIp} --dport 22 -j MASQUERADE`,
    ];

    for (const cmd of cmds) {
      try {
        await this.sh(cmd);
      } catch (err) {
        // -D fails if rule doesn't exist — log and continue
        this.logger.warn(`iptables -D skipped (rule not found?): ${cmd}`);
      }
    }

    await this.prisma.routerPortMap.update({
      where: { id: portMap.id },
      data: { rulesActive: false },
    });

    this.logger.log(`iptables rules removed for ${vpnIp}`);
  }

  // ── getAccessInfo ─────────────────────────────────────────────────────────

  async getAccessInfo(routerId: string) {
    const portMap = await this.prisma.routerPortMap.findUnique({
      where: { routerId },
      include: {
        router: {
          select: {
            accessUsername: true,
            accessPassword: true,
            wireguardIp: true,
          },
        },
      },
    });

    if (!portMap) {
      throw new NotFoundException(
        "Aucun port map pour ce routeur — appelez POST /port-map d'abord",
      );
    }

    const vps = this.vpsPublicIp;
    const { publicWebfigPort, publicWinboxPort, publicSshPort, rulesActive } =
      portMap;
    const username = portMap.router.accessUsername;

    return {
      rulesActive,
      vpnIp: portMap.vpnIp,
      webfig: {
        url: `http://${vps}:${publicWebfigPort}`,
        port: publicWebfigPort,
        label: "Ouvrir WebFig",
      },
      winbox: {
        address: `${vps}:${publicWinboxPort}`,
        port: publicWinboxPort,
        deepLink: `mikrotik://connect?address=${vps}&port=${publicWinboxPort}`,
        label: "Copier dans Winbox.exe",
      },
      ssh: {
        command: `ssh ${username}@${vps} -p ${publicSshPort}`,
        host: vps,
        port: publicSshPort,
        label: "Commande SSH",
      },
      credentials: {
        username,
        // password NOT returned here — use GET /access for the decrypted password
      },
    };
  }

  // ── testConnection ────────────────────────────────────────────────────────

  async testConnection(
    routerId: string,
  ): Promise<{ reachable: boolean; latencyMs: number }> {
    const portMap = await this.prisma.routerPortMap.findUnique({
      where: { routerId },
    });
    if (!portMap) throw new NotFoundException("Aucun port map pour ce routeur");

    const host = portMap.vpnIp;
    const port = 22;
    const start = Date.now();

    return new Promise((resolve) => {
      const socket = net.createConnection({ host, port, family: 4 });
      const timer = setTimeout(() => {
        socket.destroy();
        resolve({ reachable: false, latencyMs: 3000 });
      }, 3000);

      socket.once("connect", () => {
        clearTimeout(timer);
        socket.destroy();
        resolve({ reachable: true, latencyMs: Date.now() - start });
      });

      socket.once("error", () => {
        clearTimeout(timer);
        resolve({ reachable: false, latencyMs: Date.now() - start });
      });
    });
  }

  // ── resolveVpnIp ─────────────────────────────────────────────────────────

  async resolveVpnIp(routerId: string): Promise<string> {
    const r = await this.prisma.router.findFirst({
      where: { id: routerId, deletedAt: null },
      select: { wireguardIp: true },
    });
    if (!r) throw new NotFoundException("Routeur introuvable");
    if (!r.wireguardIp)
      throw new NotFoundException(
        "Le routeur n'a pas d'IP WireGuard — provisionnement requis",
      );
    return r.wireguardIp;
  }

  // ── restoreAllRules ───────────────────────────────────────────────────────

  /** Re-apply iptables rules for all active port maps (call on server startup after reboot). */
  async restoreAllRules(): Promise<void> {
    const activeMaps = await this.prisma.routerPortMap.findMany({
      where: { rulesActive: true },
    });

    if (activeMaps.length === 0) {
      this.logger.log("restoreAllRules: no active port maps to restore");
      return;
    }

    this.logger.log(
      `restoreAllRules: restoring iptables rules for ${activeMaps.length} router(s)`,
    );

    for (const portMap of activeMaps) {
      try {
        await this.applyIptablesRules(portMap);
      } catch (err) {
        this.logger.error(
          `restoreAllRules: failed for router ${portMap.routerId}: ${(err as Error).message}`,
        );
        // Continue with next — partial restore is better than full failure
      }
    }

    this.logger.log("restoreAllRules: done");
  }

  // ── getPortMap ────────────────────────────────────────────────────────────

  async getPortMap(routerId: string): Promise<RouterPortMap> {
    const portMap = await this.prisma.routerPortMap.findUnique({
      where: { routerId },
    });
    if (!portMap) throw new NotFoundException("Aucun port map pour ce routeur");
    return portMap;
  }

  // ── deletePortMap ─────────────────────────────────────────────────────────

  async deletePortMap(routerId: string): Promise<void> {
    const portMap = await this.prisma.routerPortMap.findUnique({
      where: { routerId },
    });
    if (!portMap) throw new NotFoundException("Aucun port map pour ce routeur");

    if (portMap.rulesActive) {
      await this.removeIptablesRules(portMap);
    }

    await this.prisma.routerPortMap.delete({ where: { routerId } });
  }
}
