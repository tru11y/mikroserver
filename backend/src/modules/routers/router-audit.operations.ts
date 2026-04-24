/**
 * Phase 1: Read-only audit of a live production MikroTik router.
 *
 * SAFETY CONTRACT:
 *   - Every function in this file is PURE READ — no /add, /set, /remove.
 *   - All commands use /print — safe to run on a router carrying live traffic.
 *   - Results are used by router-safe-onboarding.service.ts to detect conflicts
 *     BEFORE any configuration is pushed.
 */

import type { MikroTikConnection, MikroTikModule } from "./router-api.types";
import { runParsedCommand } from "./router-api.commands";
import { executeRouterOperationResult } from "./router-routeros.transport";
import type {
  ConflictReport,
  RouterAddress,
  RouterAuditSnapshot,
  RouterFirewallRule,
  RouterInterface,
  RouterRoute,
  RouterService,
  RouterWgInterface,
} from "./router-safe-onboarding.types";

// ---------------------------------------------------------------------------
// Raw RouterOS record shapes (what the mikrotik npm package returns)
// ---------------------------------------------------------------------------

interface RawInterface {
  ".id"?: string;
  name?: string;
  type?: string;
  running?: string | boolean;
  disabled?: string | boolean;
}

interface RawAddress {
  ".id"?: string;
  address?: string;
  network?: string;
  interface?: string;
  disabled?: string | boolean;
}

interface RawRoute {
  ".id"?: string;
  "dst-address"?: string;
  gateway?: string;
  distance?: string;
  active?: string | boolean;
}

interface RawFirewallRule {
  ".id"?: string;
  chain?: string;
  action?: string;
  protocol?: string;
  "dst-port"?: string;
  "in-interface"?: string;
  comment?: string;
  disabled?: string | boolean;
}

interface RawWgInterface {
  ".id"?: string;
  name?: string;
  "listen-port"?: string;
  running?: string | boolean;
}

interface RawService {
  name?: string;
  port?: string;
  disabled?: string | boolean;
  address?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toBool(v: string | boolean | undefined): boolean {
  if (typeof v === "boolean") return v;
  return v === "true" || v === "yes";
}

/**
 * Parse a CIDR address (e.g. "192.168.1.5/24") and return the network.
 * Returns null on malformed input.
 */
function cidrNetwork(
  cidr: string,
): { address: string; prefixLen: number } | null {
  const [addr, prefix] = cidr.split("/");
  if (!addr || prefix === undefined) return null;
  return { address: addr, prefixLen: parseInt(prefix, 10) };
}

/**
 * Check if two CIDR blocks overlap.
 * Used to detect if the planned VPS subnet conflicts with any existing address.
 */
function cidrsOverlap(a: string, b: string): boolean {
  const pa = cidrNetwork(a);
  const pb = cidrNetwork(b);
  if (!pa || !pb) return false;

  function toInt(ip: string): number {
    return (
      ip.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>>
      0
    );
  }

  function networkMask(prefix: number): number {
    return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  }

  const aInt = toInt(pa.address);
  const bInt = toInt(pb.address);
  const aMask = networkMask(pa.prefixLen);
  const bMask = networkMask(pb.prefixLen);
  const smallerMask = aMask < bMask ? aMask : bMask;

  return (aInt & smallerMask) === (bInt & smallerMask);
}

/**
 * Read /ip/service/print — pure read, zero side effects.
 * Returns empty array if the command fails (older ROS versions, restricted access).
 * Never throws — failure here must never block onboarding.
 */
async function readServices(
  conn: MikroTikConnection,
  parseItems: MikroTikModule["parseItems"],
): Promise<RouterService[]> {
  try {
    const rows = await runParsedCommand<RawService>(
      conn,
      parseItems,
      "/ip/service/print",
      ["=proplist=name,port,disabled,address"],
    );
    return rows.map((r) => ({
      name: r.name ?? "",
      port: parseInt(r.port ?? "0", 10),
      disabled: toBool(r.disabled),
      address: r.address ?? "",
    }));
  } catch {
    // Non-fatal: ROS may restrict /ip/service to higher-privilege users,
    // or the package may be unavailable. Audit continues without service info.
    return [];
  }
}

// ---------------------------------------------------------------------------
// Phase 1 — Read-only audit
// ---------------------------------------------------------------------------

async function readInterfaces(
  conn: MikroTikConnection,
  parseItems: MikroTikModule["parseItems"],
): Promise<RouterInterface[]> {
  const rows = await runParsedCommand<RawInterface>(
    conn,
    parseItems,
    "/interface/print",
    ["=proplist=.id,name,type,running,disabled"],
  );
  return rows.map((r) => ({
    id: r[".id"] ?? "",
    name: r.name ?? "",
    type: r.type ?? "ether",
    running: toBool(r.running),
    disabled: toBool(r.disabled),
  }));
}

async function readAddresses(
  conn: MikroTikConnection,
  parseItems: MikroTikModule["parseItems"],
): Promise<RouterAddress[]> {
  const rows = await runParsedCommand<RawAddress>(
    conn,
    parseItems,
    "/ip/address/print",
    ["=proplist=.id,address,network,interface,disabled"],
  );
  return rows.map((r) => ({
    id: r[".id"] ?? "",
    address: r.address ?? "",
    network: r.network ?? "",
    interface: r.interface ?? "",
    disabled: toBool(r.disabled),
  }));
}

async function readRoutes(
  conn: MikroTikConnection,
  parseItems: MikroTikModule["parseItems"],
): Promise<RouterRoute[]> {
  const rows = await runParsedCommand<RawRoute>(
    conn,
    parseItems,
    "/ip/route/print",
    ["=proplist=.id,dst-address,gateway,distance,active"],
  );
  return rows.map((r) => ({
    id: r[".id"] ?? "",
    dstAddress: r["dst-address"] ?? "",
    gateway: r.gateway ?? "",
    distance: parseInt(r.distance ?? "1", 10),
    active: toBool(r.active),
  }));
}

async function readFirewallRules(
  conn: MikroTikConnection,
  parseItems: MikroTikModule["parseItems"],
): Promise<RouterFirewallRule[]> {
  // Read input + forward chains — never modify
  const rows = await runParsedCommand<RawFirewallRule>(
    conn,
    parseItems,
    "/ip/firewall/filter/print",
    [
      "=proplist=.id,chain,action,protocol,dst-port,in-interface,comment,disabled",
    ],
  );
  return rows.map((r) => ({
    id: r[".id"] ?? "",
    chain: r.chain ?? "",
    action: r.action ?? "",
    protocol: r.protocol,
    dstPort: r["dst-port"],
    inInterface: r["in-interface"],
    comment: r.comment,
    disabled: toBool(r.disabled),
  }));
}

async function readWgInterfaces(
  conn: MikroTikConnection,
  parseItems: MikroTikModule["parseItems"],
): Promise<RouterWgInterface[]> {
  try {
    const rows = await runParsedCommand<RawWgInterface>(
      conn,
      parseItems,
      "/interface/wireguard/print",
      ["=proplist=.id,name,listen-port,running"],
    );
    return rows.map((r) => ({
      id: r[".id"] ?? "",
      name: r.name ?? "",
      listenPort: parseInt(r["listen-port"] ?? "51820", 10),
      running: toBool(r.running),
    }));
  } catch {
    // Router may not have WireGuard package installed — that's ok
    return [];
  }
}

/**
 * Capture a full read-only snapshot of the router's current configuration.
 * Safe to call on any live production router.
 *
 * @param params  Connection target (uses public/LAN IP before tunnel exists)
 * @param mikroNode  The `mikrotik` npm module (already loaded by callers)
 */
export async function auditRouter(params: {
  mikroNode: MikroTikModule;
  ip: string;
  apiPort: number;
  username: string;
  password: string;
  timeoutMs?: number;
}): Promise<RouterAuditSnapshot> {
  return executeRouterOperationResult({
    mikroNode: params.mikroNode,
    wireguardIp: params.ip, // field name is "wireguardIp" but here it's the LAN/public IP
    apiPort: params.apiPort,
    username: params.username,
    password: params.password,
    timeoutMs: params.timeoutMs ?? 15_000,
    operation: async (conn) => {
      const [
        interfaces,
        addresses,
        routes,
        firewallRules,
        wgInterfaces,
        services,
      ] = await Promise.all([
        readInterfaces(conn, params.mikroNode.parseItems),
        readAddresses(conn, params.mikroNode.parseItems),
        readRoutes(conn, params.mikroNode.parseItems),
        readFirewallRules(conn, params.mikroNode.parseItems),
        readWgInterfaces(conn, params.mikroNode.parseItems),
        readServices(conn, params.mikroNode.parseItems), // Gap 4 — non-fatal if empty
      ]);

      return {
        capturedAt: new Date().toISOString(),
        interfaces,
        addresses,
        routes,
        firewallRules,
        wgInterfaces,
        services,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Phase 1 — Conflict detection (pure — no I/O)
// ---------------------------------------------------------------------------

/**
 * Analyse the audit snapshot and determine if it is safe to proceed with
 * WireGuard provisioning using the given plan.
 *
 * @param snapshot   Result of auditRouter()
 * @param plan.wgInterfaceName  Name we plan to use (e.g. "wg-mks")
 * @param plan.wgIp             IP we plan to assign (e.g. "10.66.66.5/24")
 * @param plan.vpsSubnet        VPS subnet (e.g. "10.66.66.0/24")
 * @param plan.listenPort       WireGuard listen port we will use (e.g. 51820)
 */
export function detectConflicts(
  snapshot: RouterAuditSnapshot,
  plan: {
    wgInterfaceName: string;
    wgIp: string; // CIDR
    vpsSubnet: string;
    listenPort: number;
  },
): ConflictReport {
  const problems: string[] = [];

  // 1. WireGuard interface name collision
  const wgInterfaceExists = snapshot.wgInterfaces.some(
    (i) => i.name === plan.wgInterfaceName,
  );
  if (wgInterfaceExists) {
    problems.push(
      `WireGuard interface "${plan.wgInterfaceName}" already exists on this router`,
    );
  }

  // 2. Subnet overlap — does any existing address fall in our planned subnet?
  const subnetOverlaps: string[] = [];
  for (const addr of snapshot.addresses) {
    if (!addr.address || addr.disabled) continue;
    if (cidrsOverlap(addr.address, plan.vpsSubnet)) {
      subnetOverlaps.push(addr.address);
      problems.push(
        `Existing address ${addr.address} (on ${addr.interface}) overlaps with planned WG subnet ${plan.vpsSubnet}`,
      );
    }
  }

  // 3. Route conflict — existing specific route to our VPS subnet
  const routeConflicts = snapshot.routes.filter(
    (r) => r.active && cidrsOverlap(r.dstAddress, plan.vpsSubnet),
  );
  for (const r of routeConflicts) {
    problems.push(
      `Existing route ${r.dstAddress} via ${r.gateway} conflicts with planned VPS subnet route`,
    );
  }

  // 4. Listen port already bound
  const portConflict = snapshot.wgInterfaces.some(
    (i) => i.listenPort === plan.listenPort && !i.running === false,
  );
  if (portConflict) {
    problems.push(
      `WireGuard listen port ${plan.listenPort} is already bound by another interface`,
    );
  }

  // 5. FastTrack detection — WARNING ONLY, never blocking.
  //    FastTrack operates on the forward chain and cannot affect our input-chain
  //    API accept rule.  However, it can interfere with hotspot byte accounting.
  const hasFasttrack = snapshot.firewallRules.some(
    (r) => r.action === "fasttrack-connection" && !r.disabled,
  );

  // 6. API service exposed on WAN — WARNING ONLY, never blocking.
  //    Phase 6b will restrict it to VPS subnet post-tunnel.
  //    An empty address string means "no restriction" (accessible from anywhere).
  const apiService = snapshot.services.find((s) => s.name === "api");
  const apiExposedOnWan =
    apiService !== undefined &&
    !apiService.disabled &&
    apiService.address === "";

  const safe = problems.length === 0;
  const summary = safe
    ? "No conflicts detected — safe to proceed"
    : problems.join("; ");

  return {
    wgInterfaceExists,
    subnetOverlaps,
    routeConflicts,
    portConflict,
    hasFasttrack,
    apiExposedOnWan,
    safe,
    summary,
  };
}
