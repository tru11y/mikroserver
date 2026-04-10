import { UserRole } from "@prisma/client";

export const APP_PERMISSIONS = [
  "audit.view",
  "tickets.view",
  "tickets.create",
  "tickets.update",
  "tickets.delete",
  "tickets.verify",
  "tickets.export",
  "plans.view",
  "plans.manage",
  "routers.view",
  "routers.manage",
  "routers.hotspot_manage",
  "routers.health_check",
  "routers.sync",
  "routers.live_stats",
  "sessions.view",
  "sessions.terminate",
  "reports.view",
  "reports.export",
  "transactions.view",
  "settings.view",
  "settings.manage",
  "users.view",
  "users.manage",
] as const;

export type AppPermission = (typeof APP_PERMISSIONS)[number];

export const PERMISSION_GROUP_LABELS: Record<string, string> = {
  audit: "Audit",
  tickets: "Tickets",
  plans: "Forfaits",
  routers: "Routeurs",
  sessions: "Sessions",
  reports: "Rapports",
  transactions: "Transactions",
  settings: "Parametres",
  users: "Utilisateurs",
};

export const PERMISSION_DEFINITIONS: Array<{
  key: AppPermission;
  label: string;
  description: string;
  group: string;
}> = [
  {
    key: "audit.view",
    label: "Voir audit",
    description: "Consulter le journal d'audit des actions sensibles.",
    group: "audit",
  },
  {
    key: "tickets.view",
    label: "Voir tickets",
    description: "Consulter les tickets et leur etat.",
    group: "tickets",
  },
  {
    key: "tickets.create",
    label: "Creer tickets",
    description: "Generer de nouveaux tickets.",
    group: "tickets",
  },
  {
    key: "tickets.update",
    label: "Mettre a jour tickets",
    description: "Relivrer ou revoquer des tickets.",
    group: "tickets",
  },
  {
    key: "tickets.delete",
    label: "Supprimer tickets",
    description: "Supprimer des tickets non utilises.",
    group: "tickets",
  },
  {
    key: "tickets.verify",
    label: "Verifier tickets",
    description: "Verifier un ticket en caisse ou support.",
    group: "tickets",
  },
  {
    key: "tickets.export",
    label: "Exporter tickets",
    description: "Exporter en PDF ou CSV.",
    group: "tickets",
  },
  {
    key: "plans.view",
    label: "Voir forfaits",
    description: "Consulter les forfaits disponibles.",
    group: "plans",
  },
  {
    key: "plans.manage",
    label: "Gerer forfaits",
    description: "Creer, modifier ou archiver des forfaits.",
    group: "plans",
  },
  {
    key: "routers.view",
    label: "Voir routeurs",
    description: "Consulter les routeurs enregistres.",
    group: "routers",
  },
  {
    key: "routers.manage",
    label: "Gerer routeurs",
    description: "Creer, modifier ou supprimer des routeurs.",
    group: "routers",
  },
  {
    key: "routers.hotspot_manage",
    label: "Gerer hotspot",
    description: "Modifier IP bindings et profils utilisateurs hotspot.",
    group: "routers",
  },
  {
    key: "routers.health_check",
    label: "Tester routeurs",
    description: "Lancer un health-check routeur.",
    group: "routers",
  },
  {
    key: "routers.sync",
    label: "Synchroniser routeurs",
    description: "Lancer une synchronisation routeur.",
    group: "routers",
  },
  {
    key: "routers.live_stats",
    label: "Voir stats live",
    description: "Consulter les statistiques temps reel.",
    group: "routers",
  },
  {
    key: "sessions.view",
    label: "Voir sessions",
    description: "Consulter les sessions actives.",
    group: "sessions",
  },
  {
    key: "sessions.terminate",
    label: "Couper sessions",
    description: "Terminer une session active.",
    group: "sessions",
  },
  {
    key: "reports.view",
    label: "Voir rapports",
    description: "Consulter les tableaux de bord et rapports.",
    group: "reports",
  },
  {
    key: "reports.export",
    label: "Exporter rapports",
    description: "Exporter des rapports.",
    group: "reports",
  },
  {
    key: "transactions.view",
    label: "Voir transactions",
    description: "Consulter les transactions de paiement.",
    group: "transactions",
  },
  {
    key: "settings.view",
    label: "Voir parametres",
    description: "Consulter les parametres plateforme.",
    group: "settings",
  },
  {
    key: "settings.manage",
    label: "Gerer parametres",
    description: "Modifier les parametres plateforme.",
    group: "settings",
  },
  {
    key: "users.view",
    label: "Voir utilisateurs",
    description: "Consulter les comptes utilisateurs.",
    group: "users",
  },
  {
    key: "users.manage",
    label: "Gerer utilisateurs",
    description: "Creer, suspendre ou supprimer des utilisateurs.",
    group: "users",
  },
];

export const PERMISSION_PROFILES = {
  READ_ONLY: {
    label: "Lecture seule",
    description: "Consultation et verification de base.",
    permissions: [
      "tickets.view",
      "tickets.verify",
      "plans.view",
      "routers.view",
      "routers.live_stats",
      "sessions.view",
      "reports.view",
      "transactions.view",
      "settings.view",
    ],
  },
  CASHIER: {
    label: "Caissier",
    description: "Vente, verification et impression de tickets.",
    permissions: [
      "tickets.view",
      "tickets.create",
      "tickets.verify",
      "tickets.export",
      "plans.view",
      "routers.view",
      "routers.live_stats",
      "reports.view",
    ],
  },
  RESELLER_STANDARD: {
    label: "Revendeur standard",
    description:
      "Gestion terrain complete des tickets et consultation operationnelle.",
    permissions: [
      "tickets.view",
      "tickets.create",
      "tickets.update",
      "tickets.delete",
      "tickets.verify",
      "tickets.export",
      "plans.view",
      "routers.view",
      "routers.live_stats",
      "sessions.view",
      "reports.view",
      "transactions.view",
    ],
  },
  SUPERVISOR: {
    label: "Superviseur",
    description: "Pilotage tickets, supervision et rapports avances.",
    permissions: [
      "audit.view",
      "tickets.view",
      "tickets.create",
      "tickets.update",
      "tickets.delete",
      "tickets.verify",
      "tickets.export",
      "plans.view",
      "routers.view",
      "routers.hotspot_manage",
      "routers.health_check",
      "routers.sync",
      "routers.live_stats",
      "sessions.view",
      "sessions.terminate",
      "reports.view",
      "reports.export",
      "transactions.view",
    ],
  },
  TECHNICIAN: {
    label: "Technicien",
    description: "Operations routeur, sessions et diagnostic.",
    permissions: [
      "tickets.view",
      "tickets.verify",
      "plans.view",
      "routers.view",
      "routers.manage",
      "routers.health_check",
      "routers.sync",
      "routers.live_stats",
      "sessions.view",
      "sessions.terminate",
      "reports.view",
      "settings.view",
    ],
  },
  ADMIN_STANDARD: {
    label: "Admin standard",
    description:
      "Acces complet SaaS hors operations ultra-sensibles reservees au super admin.",
    permissions: [...APP_PERMISSIONS],
  },
} as const satisfies Record<
  string,
  {
    label: string;
    description: string;
    permissions: readonly AppPermission[];
  }
>;

export type PermissionProfileKey = keyof typeof PERMISSION_PROFILES;

const PERMISSION_IMPLICATIONS: Partial<
  Record<AppPermission, readonly AppPermission[]>
> = {
  "tickets.create": ["tickets.view"],
  "tickets.update": ["tickets.view"],
  "tickets.delete": ["tickets.view"],
  "tickets.verify": ["tickets.view"],
  "tickets.export": ["tickets.view"],
  "plans.manage": ["plans.view"],
  "routers.manage": ["routers.view", "routers.hotspot_manage"],
  "routers.hotspot_manage": ["routers.view"],
  "routers.health_check": ["routers.view"],
  "routers.sync": ["routers.view"],
  "routers.live_stats": ["routers.view"],
  "sessions.terminate": ["sessions.view"],
  "reports.export": ["reports.view"],
  "settings.manage": ["settings.view"],
  "users.manage": ["users.view"],
};

function expandPermissions(permissions: AppPermission[]): AppPermission[] {
  const expanded = new Set<AppPermission>(permissions);
  const queue = [...permissions];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) {
      continue;
    }

    const implied = PERMISSION_IMPLICATIONS[current] ?? [];
    for (const impliedPermission of implied) {
      if (!expanded.has(impliedPermission)) {
        expanded.add(impliedPermission);
        queue.push(impliedPermission);
      }
    }
  }

  return Array.from(expanded).sort();
}

export function sanitizePermissions(input: unknown): AppPermission[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return Array.from(
    new Set(
      input.filter(
        (value): value is AppPermission =>
          typeof value === "string" &&
          (APP_PERMISSIONS as readonly string[]).includes(value),
      ),
    ),
  ).sort();
}

export function normalizePermissionProfile(
  value: unknown,
): PermissionProfileKey | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return normalized in PERMISSION_PROFILES
    ? (normalized as PermissionProfileKey)
    : null;
}

export function resolveUserPermissions(
  role: UserRole,
  explicitPermissions: unknown,
  permissionProfile?: unknown,
): AppPermission[] {
  if (role === UserRole.SUPER_ADMIN) {
    return [...APP_PERMISSIONS];
  }

  const sanitizedExplicitPermissions = sanitizePermissions(explicitPermissions);
  if (sanitizedExplicitPermissions.length > 0) {
    return expandPermissions(sanitizedExplicitPermissions);
  }

  const normalizedProfile = normalizePermissionProfile(permissionProfile);
  if (normalizedProfile) {
    return expandPermissions([
      ...PERMISSION_PROFILES[normalizedProfile].permissions,
    ]);
  }

  switch (role) {
    case UserRole.ADMIN:
      return expandPermissions([
        ...PERMISSION_PROFILES.ADMIN_STANDARD.permissions,
      ]);
    case UserRole.RESELLER:
      return expandPermissions([
        ...PERMISSION_PROFILES.RESELLER_STANDARD.permissions,
      ]);
    case UserRole.VIEWER:
    default:
      return expandPermissions([...PERMISSION_PROFILES.READ_ONLY.permissions]);
  }
}

export function getPermissionCatalog() {
  return {
    groups: Object.entries(PERMISSION_GROUP_LABELS).map(([key, label]) => ({
      key,
      label,
      permissions: PERMISSION_DEFINITIONS.filter((item) => item.group === key),
    })),
    profiles: Object.entries(PERMISSION_PROFILES).map(([key, value]) => ({
      key,
      label: value.label,
      description: value.description,
      permissions: [...value.permissions],
    })),
  };
}
