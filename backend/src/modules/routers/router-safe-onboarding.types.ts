/**
 * Types for zero-downtime production-safe router onboarding.
 *
 * Design principle: every RouterOS object we CREATE gets its .id recorded in
 * OnboardingReceipt.  Rollback iterates the receipt and removes only those
 * objects — nothing else is touched.
 */

// ---------------------------------------------------------------------------
// Phase 1: Read-only audit
// ---------------------------------------------------------------------------

export interface RouterInterface {
  id: string;
  name: string;
  type: string;
  running: boolean;
  disabled: boolean;
}

export interface RouterAddress {
  id: string;
  address: string; // CIDR, e.g. "192.168.1.1/24"
  network: string; // e.g. "192.168.1.0"
  interface: string;
  disabled: boolean;
}

export interface RouterRoute {
  id: string;
  dstAddress: string; // e.g. "0.0.0.0/0"
  gateway: string;
  distance: number;
  active: boolean;
}

export interface RouterFirewallRule {
  id: string;
  chain: string;
  action: string;
  protocol?: string;
  dstPort?: string;
  inInterface?: string;
  comment?: string;
  disabled: boolean;
}

export interface RouterWgInterface {
  id: string;
  name: string;
  listenPort: number;
  running: boolean;
}

/** /ip/service entry — read-only, used for security visibility */
export interface RouterService {
  name: string; // e.g. "api", "www", "ssh", "winbox"
  port: number;
  disabled: boolean;
  /** Source address restriction currently configured, e.g. "10.66.66.0/24" or "" (unrestricted) */
  address: string;
}

/**
 * Full snapshot of the router's current config.
 * Nothing is written to the router during this phase.
 */
export interface RouterAuditSnapshot {
  capturedAt: string; // ISO timestamp
  interfaces: RouterInterface[];
  addresses: RouterAddress[];
  routes: RouterRoute[];
  firewallRules: RouterFirewallRule[];
  wgInterfaces: RouterWgInterface[];
  /** IP service list — present only if the router's ROS version supports /ip/service/print */
  services: RouterService[];
}

// ---------------------------------------------------------------------------
// Conflict detection (pure analysis — no side effects)
// ---------------------------------------------------------------------------

export interface ConflictReport {
  /** True if a WireGuard interface named "wg-mks" already exists */
  wgInterfaceExists: boolean;
  /**
   * IPs from the planned WG subnet that already appear on this router.
   * e.g. ["10.66.66.5/32"] if the router already has that address.
   */
  subnetOverlaps: string[];
  /**
   * Routes whose dst-address overlaps with our planned WG subnet.
   */
  routeConflicts: RouterRoute[];
  /**
   * Listen port already bound by another WireGuard interface.
   */
  portConflict: boolean;
  /**
   * WARNING (non-blocking): a fasttrack-connection rule is active on this router.
   * FastTrack does not affect the input chain and cannot block our API rule,
   * but it can interfere with hotspot accounting (known MikroTik behaviour).
   * Operator should evaluate whether to disable FastTrack for hotspot interfaces.
   */
  hasFasttrack: boolean;
  /**
   * WARNING (non-blocking): the RouterOS "api" service has no source address
   * restriction, meaning it is accessible from the WAN interface.
   * Phase 6b will restrict it to 10.66.66.0/24 after tunnel confirmation.
   * Populated only when /ip/service/print was available in the audit.
   */
  apiExposedOnWan: boolean;
  /** Plain-English summary, empty if no conflicts */
  summary: string;
  safe: boolean;
}

// ---------------------------------------------------------------------------
// Phase 2–3: What we actually create (tracked for rollback)
// ---------------------------------------------------------------------------

/**
 * Receipt of every RouterOS object added during onboarding.
 * If provisioning fails at any step, only these .id values are removed.
 * Nothing else on the router is touched.
 */
export interface OnboardingReceipt {
  /** RouterOS .id of the created WireGuard interface, if added */
  wgInterfaceId?: string;
  /** RouterOS .id of the WireGuard peer entry, if added */
  wgPeerId?: string;
  /** RouterOS .id of the IP address assigned to the WG interface */
  wgAddressId?: string;
  /** RouterOS .id of the specific route to the VPS subnet */
  wgRouteId?: string;
  /** RouterOS .id of the firewall input-accept rule for API, if added */
  firewallRuleId?: string;
  /** Timestamp when provisioning started (for audit logs) */
  startedAt: string;
  /** Accumulated log of every step attempted */
  log: OnboardingLogEntry[];
}

export interface OnboardingLogEntry {
  step: string;
  status: "ok" | "skip" | "warn" | "error";
  message: string;
  ts: string;
}

// ---------------------------------------------------------------------------
// Phase 4: Validation
// ---------------------------------------------------------------------------

export interface TunnelValidationResult {
  handshakeRecent: boolean;
  handshakeAgeSeconds: number | null;
  apiReachable: boolean;
  rttMs?: number;
}

// ---------------------------------------------------------------------------
// Full onboarding result
// ---------------------------------------------------------------------------

export interface OnboardingResult {
  success: boolean;
  wgIp: string;
  receipt: OnboardingReceipt;
  audit: RouterAuditSnapshot;
  conflicts: ConflictReport;
  validation?: TunnelValidationResult;
  /** Set when onboarding failed and rollback ran */
  rollbackRan?: boolean;
  error?: string;
}
