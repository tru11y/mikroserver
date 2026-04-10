import { ConflictException, ForbiddenException } from "@nestjs/common";
import { Prisma, UserRole, Voucher, VoucherStatus } from "@prisma/client";
import {
  PlanTicketSettings,
  PlanTicketSettingsInput,
  buildDefaultPlanTicketSettings,
  normalizePlanTicketSettings,
} from "../plans/plan-ticket-settings";

const MIN_CODE_LENGTH = 4;
const MAX_CODE_LENGTH = 16;

type InventoryVoucherLike = {
  planId: string;
  status: VoucherStatus;
  activatedAt: Date | null;
  plan: {
    name: string;
    durationMinutes: number;
    priceXof: number;
  };
  router?: {
    id: string;
    name: string;
    status: string | null;
  } | null;
  createdBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
};

type DeletableVoucherLike = Pick<
  Voucher,
  "status" | "activatedAt" | "createdById"
> & { session: { id: string } | null };

export function buildVoucherInventorySummary(vouchers: InventoryVoucherLike[]) {
  const totals = {
    total: vouchers.length,
    printable: 0,
    ready: 0,
    pendingProvisioning: 0,
    active: 0,
    used: 0,
    expired: 0,
    issues: 0,
    revoked: 0,
  };

  const byPlan = new Map<
    string,
    {
      planId: string;
      planName: string;
      durationMinutes: number;
      priceXof: number;
      total: number;
      printable: number;
      ready: number;
      active: number;
      expired: number;
      issues: number;
    }
  >();

  const byRouter = new Map<
    string,
    {
      routerId: string | null;
      routerName: string;
      routerStatus: string | null;
      total: number;
      printable: number;
      ready: number;
      active: number;
      expired: number;
      issues: number;
    }
  >();

  const byReseller = new Map<
    string,
    {
      resellerId: string | null;
      resellerName: string;
      email: string | null;
      total: number;
      printable: number;
      ready: number;
      active: number;
      expired: number;
      issues: number;
    }
  >();

  for (const voucher of vouchers) {
    const printable = isVoucherPrintable(voucher);
    const ready =
      voucher.status === VoucherStatus.DELIVERED && !voucher.activatedAt;
    const active = voucher.status === VoucherStatus.ACTIVE;
    const expired = voucher.status === VoucherStatus.EXPIRED;
    const issues =
      voucher.status === VoucherStatus.DELIVERY_FAILED ||
      voucher.status === VoucherStatus.REVOKED;
    const used = voucher.activatedAt !== null || active || expired;

    if (printable) totals.printable += 1;
    if (ready) totals.ready += 1;
    if (voucher.status === VoucherStatus.GENERATED && !voucher.activatedAt) {
      totals.pendingProvisioning += 1;
    }
    if (active) totals.active += 1;
    if (used) totals.used += 1;
    if (expired) totals.expired += 1;
    if (issues) totals.issues += 1;
    if (voucher.status === VoucherStatus.REVOKED) totals.revoked += 1;

    const planEntry = byPlan.get(voucher.planId) ?? {
      planId: voucher.planId,
      planName: voucher.plan.name,
      durationMinutes: voucher.plan.durationMinutes,
      priceXof: voucher.plan.priceXof,
      total: 0,
      printable: 0,
      ready: 0,
      active: 0,
      expired: 0,
      issues: 0,
    };
    planEntry.total += 1;
    if (printable) planEntry.printable += 1;
    if (ready) planEntry.ready += 1;
    if (active) planEntry.active += 1;
    if (expired) planEntry.expired += 1;
    if (issues) planEntry.issues += 1;
    byPlan.set(voucher.planId, planEntry);

    const routerKey = voucher.router?.id ?? "unassigned";
    const routerEntry = byRouter.get(routerKey) ?? {
      routerId: voucher.router?.id ?? null,
      routerName: voucher.router?.name ?? "Sans routeur",
      routerStatus: voucher.router?.status ?? null,
      total: 0,
      printable: 0,
      ready: 0,
      active: 0,
      expired: 0,
      issues: 0,
    };
    routerEntry.total += 1;
    if (printable) routerEntry.printable += 1;
    if (ready) routerEntry.ready += 1;
    if (active) routerEntry.active += 1;
    if (expired) routerEntry.expired += 1;
    if (issues) routerEntry.issues += 1;
    byRouter.set(routerKey, routerEntry);

    const resellerKey = voucher.createdBy?.id ?? "system";
    const resellerEntry = byReseller.get(resellerKey) ?? {
      resellerId: voucher.createdBy?.id ?? null,
      resellerName: voucher.createdBy
        ? `${voucher.createdBy.firstName} ${voucher.createdBy.lastName}`.trim()
        : "Système / Admin",
      email: voucher.createdBy?.email ?? null,
      total: 0,
      printable: 0,
      ready: 0,
      active: 0,
      expired: 0,
      issues: 0,
    };
    resellerEntry.total += 1;
    if (printable) resellerEntry.printable += 1;
    if (ready) resellerEntry.ready += 1;
    if (active) resellerEntry.active += 1;
    if (expired) resellerEntry.expired += 1;
    if (issues) resellerEntry.issues += 1;
    byReseller.set(resellerKey, resellerEntry);
  }

  return {
    totals,
    byPlan: Array.from(byPlan.values()).sort(
      (a, b) => b.printable - a.printable || b.total - a.total,
    ),
    byRouter: Array.from(byRouter.values()).sort(
      (a, b) => b.printable - a.printable || b.total - a.total,
    ),
    byReseller: Array.from(byReseller.values()).sort(
      (a, b) => b.printable - a.printable || b.total - a.total,
    ),
  };
}

export function normalizeVoucherCode(
  code: string,
  voucherPrefix: string,
): string {
  const sanitized = code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!sanitized) {
    return "";
  }

  const prefix = voucherPrefix.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const core = sanitized.startsWith(prefix)
    ? sanitized.slice(prefix.length)
    : sanitized;

  return [prefix, ...chunkCode(core)].join("-");
}

export function buildVoucherCodeCandidates(
  code: string,
  voucherPrefix: string,
): string[] {
  const raw = code.trim();
  if (!raw) {
    return [];
  }

  const compact = raw.replace(/[\s]+/g, "");
  const collapsed = raw.replace(/[\s-]+/g, "");
  const normalized = normalizeVoucherCode(raw, voucherPrefix);

  return Array.from(
    new Set(
      [
        raw,
        raw.toLowerCase(),
        raw.toUpperCase(),
        compact,
        compact.toLowerCase(),
        compact.toUpperCase(),
        collapsed,
        collapsed.toLowerCase(),
        collapsed.toUpperCase(),
        normalized,
        normalized.toLowerCase(),
      ].filter(Boolean),
    ),
  );
}

export function buildCodeSearchWhere(
  search: string | undefined,
  voucherPrefix: string,
): Prisma.VoucherWhereInput | undefined {
  if (!search?.trim()) {
    return undefined;
  }

  const candidates = buildVoucherCodeCandidates(search, voucherPrefix);
  if (candidates.length === 0) {
    return undefined;
  }

  return {
    OR: candidates.map((candidate) => ({
      code: {
        contains: candidate,
        mode: "insensitive",
      },
    })),
  };
}

export function normalizeCodeLength(
  codeLength: number | undefined,
  defaultCodeLength: number,
): number {
  if (!codeLength || Number.isNaN(codeLength)) {
    return defaultCodeLength;
  }

  return Math.max(
    MIN_CODE_LENGTH,
    Math.min(MAX_CODE_LENGTH, Math.trunc(codeLength)),
  );
}

export function chunkCode(code: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < code.length; i += 4) {
    chunks.push(code.slice(i, i + 4));
  }
  return chunks;
}

export function normalizeTicketPrefix(prefix?: string): string {
  return (prefix ?? "")
    .trim()
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 12);
}

export function shouldUseGroupedFormat(
  prefix: string,
  numericOnly: boolean,
  voucherPrefix: string,
): boolean {
  return (
    !numericOnly &&
    prefix.length > 0 &&
    prefix.toUpperCase() === voucherPrefix.toUpperCase()
  );
}

export function getPlanTicketSettings(
  metadata: unknown,
  voucherPrefix: string,
  defaultCodeLength: number,
): PlanTicketSettings {
  const currentMetadata =
    typeof metadata === "object" &&
    metadata !== null &&
    !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

  return normalizePlanTicketSettings(
    currentMetadata["ticketSettings"] as PlanTicketSettingsInput,
    buildDefaultPlanTicketSettings(voucherPrefix, defaultCodeLength),
  );
}

export function buildUsageWhere(
  usageState: "ALL" | "UNUSED" | "USED" | "READY" | "ISSUES" | undefined,
): Record<string, unknown> {
  switch (usageState) {
    case "UNUSED":
      return { activatedAt: null };
    case "USED":
      return {
        OR: [
          { activatedAt: { not: null } },
          { status: VoucherStatus.ACTIVE },
          { status: VoucherStatus.EXPIRED },
        ],
      };
    case "READY":
      return {
        status: VoucherStatus.DELIVERED,
        activatedAt: null,
      };
    case "ISSUES":
      return {
        status: {
          in: [VoucherStatus.DELIVERY_FAILED, VoucherStatus.REVOKED],
        },
      };
    default:
      return {};
  }
}

export function isVoucherPrintable(
  voucher: Pick<Voucher, "status" | "activatedAt">,
): boolean {
  return (
    voucher.activatedAt === null &&
    (voucher.status === VoucherStatus.GENERATED ||
      voucher.status === VoucherStatus.DELIVERED)
  );
}

export function ensureVoucherCanBeDeleted(
  voucher: DeletableVoucherLike,
  actor: { sub: string; role: UserRole },
) {
  if (
    actor.role === UserRole.RESELLER &&
    voucher.createdById &&
    voucher.createdById !== actor.sub
  ) {
    throw new ForbiddenException(
      "Vous ne pouvez supprimer que vos propres tickets.",
    );
  }

  if (!canVoucherBeHardDeleted(voucher)) {
    throw new ConflictException(
      "Impossible de supprimer un ticket deja utilise. Conservez son historique ou revoquez-le.",
    );
  }
}

export function canVoucherBeHardDeleted(
  voucher: DeletableVoucherLike,
): boolean {
  const hasBeenUsed =
    voucher.activatedAt !== null ||
    voucher.status === VoucherStatus.ACTIVE ||
    voucher.status === VoucherStatus.EXPIRED;

  return !hasBeenUsed && !voucher.session;
}

export function getBulkDeleteFailureReason(error: unknown): string {
  if (
    error instanceof ConflictException ||
    error instanceof ForbiddenException
  ) {
    const response = error.getResponse();
    if (typeof response === "string") {
      return response;
    }
    if (
      typeof response === "object" &&
      response !== null &&
      "message" in response &&
      typeof response["message"] === "string"
    ) {
      return response["message"];
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Suppression impossible pour ce ticket.";
}

export function getPublicStatusInfo(status: VoucherStatus): {
  canLogin: boolean;
  message: string;
  advice: string;
} {
  switch (status) {
    case VoucherStatus.GENERATED:
      return {
        canLogin: false,
        message:
          "Ce ticket existe, mais il n’est pas encore disponible sur le routeur.",
        advice:
          "Patiente quelques instants ou contacte le vendeur pour relancer la livraison.",
      };
    case VoucherStatus.DELIVERED:
      return {
        canLogin: true,
        message: "Ce ticket est valide et pret a etre utilise sur le hotspot.",
        advice:
          "Connecte-toi au WiFi, puis saisis ce même ticket dans les champs identifiant et mot de passe si nécessaire.",
      };
    case VoucherStatus.ACTIVE:
      return {
        canLogin: true,
        message:
          "Ce ticket a deja ete active et il est reconnu par la plateforme.",
        advice:
          "Si tu es deconnecte, reconnecte-toi au hotspot avec le même ticket dans les champs requis.",
      };
    case VoucherStatus.EXPIRED:
      return {
        canLogin: false,
        message: "Ce ticket est expire.",
        advice: "Demande un nouveau ticket au vendeur ou a l’administrateur.",
      };
    case VoucherStatus.REVOKED:
      return {
        canLogin: false,
        message: "Ce ticket a ete revoque.",
        advice:
          "Contacte le vendeur ou l’administrateur pour obtenir un ticket valide.",
      };
    case VoucherStatus.DELIVERY_FAILED:
      return {
        canLogin: false,
        message: "La livraison de ce ticket vers le routeur a echoue.",
        advice: "Le vendeur doit relancer la livraison avant utilisation.",
      };
    default:
      return {
        canLogin: false,
        message: "Statut du ticket inconnu.",
        advice: "Contacte le support ou le vendeur.",
      };
  }
}
