import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import pLimit from "p-limit";
import argon2 from "argon2";
import { PrismaService } from "../prisma/prisma.service";
import { QueueService } from "../queue/queue.service";
import { ConfigService } from "@nestjs/config";
import {
  VoucherStatus,
  Voucher,
  GenerationType,
  SessionStatus,
  UserRole,
  Prisma,
  AuditAction,
} from "@prisma/client";
import { RouterApiService } from "../routers/router-api.service";
import { AuditService } from "../audit/audit.service";
import { scopeVoucherToOwner } from "../../common/helpers/tenant-scope.helper";
import {
  buildCodeSearchWhere,
  buildUsageWhere,
  buildVoucherCodeCandidates,
  buildVoucherInventorySummary,
  canVoucherBeHardDeleted,
  chunkCode,
  ensureVoucherCanBeDeleted,
  getBulkDeleteFailureReason,
  getPlanTicketSettings,
  getPublicStatusInfo,
  normalizeCodeLength,
  normalizeTicketPrefix,
  shouldUseGroupedFormat,
} from "./voucher.service.helpers";

const CODE_LENGTH = 12;
const COLLISION_MAX_RETRIES = 3;
const CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const NUMERIC_CHARSET = "0123456789";

export interface VoucherVerificationResult {
  source: "SAAS" | "LEGACY";
  voucherId: string | null;
  routerId: string | null;
  code: string;
  status: VoucherStatus;
  canLogin: boolean;
  planName: string;
  durationMinutes: number;
  priceXof: number;
  routerName: string | null;
  deliveredAt: Date | null;
  activatedAt: Date | null;
  expiresAt: Date | null;
  message: string;
  advice: string;
}

export interface VoucherPermanentDeleteResult {
  source: "SAAS" | "LEGACY";
  code: string;
  routerId: string | null;
  removedFromRouter: boolean;
  removedFromDatabase: boolean;
  historyPreserved: boolean;
  message: string;
}

export interface VoucherBulkDeleteResult {
  requestedCount: number;
  deletedCount: number;
  skippedCount: number;
  deleted: Array<{
    voucherId: string;
    code: string;
  }>;
  skipped: Array<{
    voucherId: string;
    code: string | null;
    reason: string;
  }>;
}

interface VoucherListFilters {
  search?: string;
  statuses?: VoucherStatus[];
  usageState?: "ALL" | "UNUSED" | "USED" | "READY" | "ISSUES";
}

interface GenerateBulkOptions {
  codeLength?: number;
  ticketPrefix?: string;
  ticketType?: "PIN" | "USER_PASSWORD";
  numericOnly?: boolean;
  passwordLength?: number;
  passwordNumericOnly?: boolean;
}

@Injectable()
export class VoucherService {
  private readonly logger = new Logger(VoucherService.name);
  private readonly voucherPrefix: string;
  private readonly defaultCodeLength: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
    private readonly routerApiService: RouterApiService,
    private readonly auditService: AuditService,
  ) {
    this.voucherPrefix = this.configService.get<string>(
      "mikrotik.voucherPrefix",
      "MS",
    );
    this.defaultCodeLength = normalizeCodeLength(
      this.configService.get<number>(
        "MIKROTIK_VOUCHER_CODE_LENGTH",
        CODE_LENGTH,
      ),
      CODE_LENGTH,
    );
  }

  // ---------------------------------------------------------------------------
  // List / Get
  // ---------------------------------------------------------------------------

  async findAll(
    page: number,
    limit: number,
    actor: { sub: string; role: UserRole },
    filters?: VoucherListFilters,
  ) {
    const skip = (page - 1) * limit;
    const whereClauses: Prisma.VoucherWhereInput[] = [];

    // Tenant isolation: RESELLER sees only their own vouchers; ADMIN sees only
    // vouchers on their own routers; SUPER_ADMIN sees everything.
    const tenantScope = scopeVoucherToOwner(actor.sub, actor.role);
    if (Object.keys(tenantScope).length > 0) {
      whereClauses.push(tenantScope);
    }

    if (filters?.statuses?.length) {
      whereClauses.push({ status: { in: filters.statuses } });
    }

    const usageWhere = buildUsageWhere(filters?.usageState);
    if (Object.keys(usageWhere).length > 0) {
      whereClauses.push(usageWhere);
    }

    const searchWhere = buildCodeSearchWhere(
      filters?.search,
      this.voucherPrefix,
    );
    if (searchWhere) {
      whereClauses.push(searchWhere);
    }

    const where: Prisma.VoucherWhereInput =
      whereClauses.length > 0 ? { AND: whereClauses } : {};

    const [items, total] = await Promise.all([
      this.prisma.voucher.findMany({
        skip,
        take: limit,
        where,
        orderBy: { createdAt: "desc" },
        include: {
          plan: {
            select: { name: true, priceXof: true, durationMinutes: true },
          },
          createdBy: {
            select: { firstName: true, lastName: true, email: true },
          },
          router: { select: { name: true, status: true } },
        },
      }),
      this.prisma.voucher.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        id: item.id,
        code: item.code,
        status: item.status,
        expiresAt: item.expiresAt,
        activatedAt: item.activatedAt,
        createdAt: item.createdAt,
        deliveredAt: item.deliveredAt,
        generationType: item.generationType,
        routerId: item.routerId,
        routerName: item.router?.name ?? null,
        routerStatus: item.router?.status ?? null,
        planName: item.plan.name,
        planPriceXof: item.plan.priceXof,
        planDurationMinutes: item.plan.durationMinutes,
        createdByName: item.createdBy
          ? `${item.createdBy.firstName} ${item.createdBy.lastName}`.trim()
          : null,
        lastDeliveryError: item.lastDeliveryError,
        deliveryAttempts: item.deliveryAttempts,
      })),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id },
      include: {
        plan: true,
        transaction: true,
        router: { select: { id: true, name: true, status: true } },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!voucher) throw new NotFoundException(`Voucher ${id} not found`);
    return voucher;
  }

  async getInventorySummary(actor: { sub: string; role: UserRole }) {
    const where: Prisma.VoucherWhereInput = scopeVoucherToOwner(
      actor.sub,
      actor.role,
    );
    const vouchers = await this.prisma.voucher.findMany({
      where,
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            durationMinutes: true,
            priceXof: true,
          },
        },
        router: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return buildVoucherInventorySummary(vouchers);
  }

  async verifyVoucherForOperator(
    ticket: string,
    password: string | undefined,
    actor: { sub: string; role: UserRole },
    preferredRouterId?: string,
  ): Promise<VoucherVerificationResult> {
    const codeCandidates = buildVoucherCodeCandidates(
      ticket,
      this.voucherPrefix,
    );
    if (codeCandidates.length === 0) {
      throw new UnauthorizedException("Code ou mot de passe invalide");
    }

    const passwordCandidates = Array.from(
      new Set(
        [
          password?.trim(),
          ticket.trim(),
          ...buildVoucherCodeCandidates(password ?? "", this.voucherPrefix),
          ...codeCandidates,
        ].filter((value): value is string => Boolean(value)),
      ),
    );

    const voucher = await this.prisma.voucher.findFirst({
      where: {
        ...(preferredRouterId ? { routerId: preferredRouterId } : {}),
        OR: codeCandidates.map((candidate) => ({
          code: {
            equals: candidate,
            mode: "insensitive",
          },
        })),
      },
      include: {
        plan: {
          select: {
            name: true,
            durationMinutes: true,
            priceXof: true,
          },
        },
        router: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!voucher) {
      const legacyTicket = await this.routerApiService.findLegacyTicket(
        codeCandidates,
        passwordCandidates,
        preferredRouterId,
      );

      if (!legacyTicket) {
        throw new UnauthorizedException("Code ou mot de passe invalide");
      }

      if (password?.trim() && legacyTicket.passwordMatches === false) {
        throw new UnauthorizedException("Code ou mot de passe invalide");
      }

      const canLogin = !legacyTicket.disabled;
      const message = canLogin
        ? legacyTicket.active
          ? "Ce ticket legacy est actuellement actif sur le hotspot."
          : "Ce ticket legacy existe bien sur le routeur."
        : "Ce ticket legacy existe mais il est actuellement desactive sur le routeur.";
      const advice = password?.trim()
        ? legacyTicket.passwordMatches === null
          ? "Le routeur a confirme l'existence du ticket, mais le mot de passe exact n'est pas lisible via l'API. Controle manuel recommande."
          : "Verification effectuee directement sur le routeur pour un ticket legacy existant."
        : "Verification effectuee directement sur le routeur pour un ticket legacy. Saisis le code exact, en respectant les minuscules si le ticket papier en contient.";

      return {
        source: "LEGACY",
        voucherId: null,
        routerId: legacyTicket.routerId,
        code: legacyTicket.code,
        status: legacyTicket.active
          ? VoucherStatus.ACTIVE
          : canLogin
            ? VoucherStatus.DELIVERED
            : VoucherStatus.REVOKED,
        canLogin,
        planName: legacyTicket.planName,
        durationMinutes: legacyTicket.durationMinutes,
        priceXof: 0,
        routerName: legacyTicket.routerName,
        deliveredAt: legacyTicket.deliveredAt,
        activatedAt: legacyTicket.activatedAt,
        expiresAt: legacyTicket.expiresAt,
        message,
        advice,
      };
    }

    const shouldValidatePassword = Boolean(password?.trim());
    if (!shouldValidatePassword) {
      let sameCredentialValid = false;
      for (const candidate of passwordCandidates) {
        sameCredentialValid = await argon2.verify(
          voucher.passwordHash,
          candidate,
        );
        if (sameCredentialValid) {
          break;
        }
      }

      if (!sameCredentialValid) {
        throw new UnauthorizedException(
          "Ce ticket existe mais utilise un ancien mot de passe distinct. Activez la verification avancee.",
        );
      }

      const statusInfo = getPublicStatusInfo(voucher.status);

      return {
        source: "SAAS",
        voucherId: voucher.id,
        routerId: voucher.routerId,
        code: voucher.code,
        status: voucher.status,
        canLogin: statusInfo.canLogin,
        planName: voucher.plan.name,
        durationMinutes: voucher.plan.durationMinutes,
        priceXof: voucher.plan.priceXof,
        routerName: voucher.router?.name ?? null,
        deliveredAt: voucher.deliveredAt ?? null,
        activatedAt: voucher.activatedAt ?? null,
        expiresAt: voucher.expiresAt ?? null,
        message: statusInfo.message,
        advice: `${statusInfo.advice} Verification effectuee avec le meme ticket comme code et mot de passe.`,
      };
    }

    let passwordValid = false;
    for (const candidate of passwordCandidates) {
      passwordValid = await argon2.verify(voucher.passwordHash, candidate);
      if (passwordValid) {
        break;
      }
    }

    if (!passwordValid) {
      throw new UnauthorizedException("Code ou mot de passe invalide");
    }

    const statusInfo = getPublicStatusInfo(voucher.status);

    return {
      source: "SAAS",
      voucherId: voucher.id,
      routerId: voucher.routerId,
      code: voucher.code,
      status: voucher.status,
      canLogin: statusInfo.canLogin,
      planName: voucher.plan.name,
      durationMinutes: voucher.plan.durationMinutes,
      priceXof: voucher.plan.priceXof,
      routerName: voucher.router?.name ?? null,
      deliveredAt: voucher.deliveredAt ?? null,
      activatedAt: voucher.activatedAt ?? null,
      expiresAt: voucher.expiresAt ?? null,
      message: statusInfo.message,
      advice: statusInfo.advice,
    };
  }

  async deleteTicketPermanently(
    ticket: string,
    password: string | undefined,
    actor: { sub: string; role: UserRole },
    preferredRouterId?: string,
  ): Promise<VoucherPermanentDeleteResult> {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        "Seuls les administrateurs peuvent supprimer un ticket de manière permanente.",
      );
    }

    const codeCandidates = buildVoucherCodeCandidates(
      ticket,
      this.voucherPrefix,
    );
    if (codeCandidates.length === 0) {
      throw new UnauthorizedException("Code ou mot de passe invalide");
    }

    const passwordCandidates = Array.from(
      new Set(
        [
          password?.trim(),
          ticket.trim(),
          ...buildVoucherCodeCandidates(password ?? "", this.voucherPrefix),
          ...codeCandidates,
        ].filter((value): value is string => Boolean(value)),
      ),
    );

    const voucher = await this.prisma.voucher.findFirst({
      where: {
        ...(preferredRouterId ? { routerId: preferredRouterId } : {}),
        OR: codeCandidates.map((candidate) => ({
          code: {
            equals: candidate,
            mode: "insensitive",
          },
        })),
      },
      include: {
        session: true,
      },
    });

    if (voucher) {
      if (voucher.routerId) {
        await this.routerApiService.disconnectActiveSessionsByUsername(
          voucher.routerId,
          voucher.code,
        );
        await this.routerApiService.removeHotspotUser(
          voucher.routerId,
          voucher.code,
        );
      }

      await this.prisma.session.updateMany({
        where: {
          voucherId: voucher.id,
          status: SessionStatus.ACTIVE,
        },
        data: {
          status: SessionStatus.TERMINATED,
          terminatedAt: new Date(),
          terminateReason: "manual_permanent_delete",
        },
      });

      if (canVoucherBeHardDeleted(voucher)) {
        await this.prisma.voucher.delete({
          where: { id: voucher.id },
        });

        await this.auditService.log({
          userId: actor.sub,
          action: AuditAction.DELETE,
          entityType: "Voucher",
          entityId: voucher.id,
          oldValues: {
            code: voucher.code,
            planId: voucher.planId,
            routerId: voucher.routerId,
            status: voucher.status,
            createdById: voucher.createdById,
          },
          description: `Voucher ${voucher.code} deleted permanently by admin`,
        });

        return {
          source: "SAAS",
          code: voucher.code,
          routerId: voucher.routerId,
          removedFromRouter: Boolean(voucher.routerId),
          removedFromDatabase: true,
          historyPreserved: false,
          message:
            "Ticket supprimé définitivement du routeur et de la plateforme.",
        };
      }

      const nextStatus =
        voucher.status === VoucherStatus.EXPIRED
          ? VoucherStatus.EXPIRED
          : VoucherStatus.REVOKED;

      await this.prisma.voucher.update({
        where: { id: voucher.id },
        data: {
          status: nextStatus,
          revokedAt: new Date(),
        },
      });

      await this.auditService.log({
        userId: actor.sub,
        action: AuditAction.UPDATE,
        entityType: "Voucher",
        entityId: voucher.id,
        oldValues: {
          status: voucher.status,
          routerId: voucher.routerId,
        },
        newValues: {
          status: nextStatus,
          revokedAt: new Date().toISOString(),
        },
        description: `Voucher ${voucher.code} removed permanently from MikroTik while preserving history`,
      });

      return {
        source: "SAAS",
        code: voucher.code,
        routerId: voucher.routerId,
        removedFromRouter: Boolean(voucher.routerId),
        removedFromDatabase: false,
        historyPreserved: true,
        message:
          "Ticket retiré définitivement du routeur. Son historique a été conservé dans la plateforme.",
      };
    }

    const legacyTicket = await this.routerApiService.findLegacyTicket(
      codeCandidates,
      passwordCandidates,
      preferredRouterId,
    );

    if (!legacyTicket) {
      throw new UnauthorizedException("Code ou mot de passe invalide");
    }

    if (password?.trim() && legacyTicket.passwordMatches === false) {
      throw new UnauthorizedException("Code ou mot de passe invalide");
    }

    await this.routerApiService.disconnectActiveSessionsByUsername(
      legacyTicket.routerId,
      legacyTicket.code,
    );
    await this.routerApiService.removeHotspotUser(
      legacyTicket.routerId,
      legacyTicket.code,
    );

    await this.auditService.log({
      userId: actor.sub,
      action: AuditAction.DELETE,
      entityType: "LegacyTicket",
      entityId: `${legacyTicket.routerId}:${legacyTicket.code}`,
      oldValues: {
        code: legacyTicket.code,
        routerId: legacyTicket.routerId,
        routerName: legacyTicket.routerName,
      },
      description: `Legacy ticket ${legacyTicket.code} removed permanently from MikroTik`,
    });

    return {
      source: "LEGACY",
      code: legacyTicket.code,
      routerId: legacyTicket.routerId,
      removedFromRouter: true,
      removedFromDatabase: false,
      historyPreserved: false,
      message: "Ticket legacy supprimé définitivement du routeur MikroTik.",
    };
  }

  // ---------------------------------------------------------------------------
  // Generate after successful payment (AUTO)
  // ---------------------------------------------------------------------------

  async generateForTransaction(
    transactionId: string,
    planId: string,
    routerId?: string,
  ): Promise<Voucher> {
    const existing = await this.prisma.voucher.findUnique({
      where: { transactionId },
    });

    if (existing) {
      this.logger.warn(
        `Voucher already exists for transaction ${transactionId}`,
      );
      return existing;
    }

    const plan = await this.prisma.plan.findUniqueOrThrow({
      where: { id: planId },
    });
    const planTicketSettings = getPlanTicketSettings(
      plan.metadata,
      this.voucherPrefix,
      this.defaultCodeLength,
    );
    const code = await this.generateUniqueCode({
      codeLength: planTicketSettings.ticketCodeLength,
      prefix: planTicketSettings.ticketPrefix,
      numericOnly: planTicketSettings.ticketNumericOnly,
    });
    const password = code;
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
    });

    const voucher = await this.prisma.voucher.create({
      data: {
        transactionId,
        planId,
        routerId,
        generationType: GenerationType.AUTO,
        code,
        passwordHash,
        passwordPlain: password,
        status: VoucherStatus.GENERATED,
        mikrotikComment: `Ref:${transactionId.slice(0, 8)} Plan:${plan.slug}`,
      },
    });

    this.logger.log(
      `Voucher generated: ${voucher.id} code=${code} tx=${transactionId}`,
    );

    await this.queueService.enqueueVoucherDelivery({
      voucherId: voucher.id,
      routerId: routerId,
    });

    return voucher;
  }

  // ---------------------------------------------------------------------------
  // Bulk MANUAL generation (for resellers / admins, no transaction needed)
  // ---------------------------------------------------------------------------

  async generateBulk(
    planId: string,
    routerId: string | undefined | null,
    count: number,
    createdById?: string,
    options?: GenerateBulkOptions,
  ): Promise<
    Array<
      Voucher & {
        plan: { name: string; priceXof: number; durationMinutes: number };
      }
    >
  > {
    if (count < 1 || count > 500) {
      throw new Error("Count must be between 1 and 500");
    }

    // Treat empty string as null (routerId is optional in the Prisma schema)
    const resolvedRouterId =
      routerId && routerId.trim() !== "" ? routerId : null;

    const plan = await this.prisma.plan.findUniqueOrThrow({
      where: { id: planId, status: "ACTIVE" },
    });
    const planTicketSettings = getPlanTicketSettings(
      plan.metadata,
      this.voucherPrefix,
      this.defaultCodeLength,
    );
    const ticketType = options?.ticketType ?? planTicketSettings.ticketType;
    const codeLength = normalizeCodeLength(
      options?.codeLength ?? planTicketSettings.ticketCodeLength,
      this.defaultCodeLength,
    );
    const passwordLength = normalizeCodeLength(
      options?.passwordLength ?? planTicketSettings.ticketPasswordLength,
      this.defaultCodeLength,
    );
    const ticketPrefix = normalizeTicketPrefix(
      options?.ticketPrefix ?? planTicketSettings.ticketPrefix,
    );
    const ticketNumericOnly =
      options?.numericOnly ?? planTicketSettings.ticketNumericOnly;
    const ticketPasswordNumericOnly =
      options?.passwordNumericOnly ??
      planTicketSettings.ticketPasswordNumericOnly;

    const limit = pLimit(3);

    const vouchers: Voucher[] = await Promise.all(
      Array.from({ length: count }, () =>
        limit(async () => {
          const code = await this.generateUniqueCode({
            codeLength,
            prefix: ticketPrefix,
            numericOnly: ticketNumericOnly,
          });
          const password =
            ticketType === "PIN"
              ? code
              : this.generateCredential(
                  passwordLength,
                  ticketPasswordNumericOnly,
                );
          const passwordHash = await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 19456,
            timeCost: 2,
          });

          const voucher = await this.prisma.voucher.create({
            data: {
              planId,
              routerId: resolvedRouterId,
              createdById: createdById ?? null,
              generationType: GenerationType.MANUAL,
              code,
              passwordHash,
              passwordPlain: password,
              status: VoucherStatus.GENERATED,
              mikrotikComment: `MANUAL Plan:${plan.slug} Type:${ticketType}`,
            },
          });

          await this.queueService.enqueueVoucherDelivery({
            voucherId: voucher.id,
            routerId: resolvedRouterId ?? undefined,
          });

          return voucher;
        }),
      ),
    );

    this.logger.log(
      `Bulk generated ${count} MANUAL vouchers for plan "${plan.slug}" by ${createdById ?? "system"} with code length ${codeLength} router=${resolvedRouterId ?? "none"}`,
    );

    return this.prisma.voucher.findMany({
      where: {
        id: {
          in: vouchers.map((voucher) => voucher.id),
        },
      },
      include: {
        plan: {
          select: {
            name: true,
            priceXof: true,
            durationMinutes: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  // ---------------------------------------------------------------------------
  // Revoke
  // ---------------------------------------------------------------------------

  async revokeVoucher(voucherId: string): Promise<Voucher> {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
    });
    if (!voucher) throw new NotFoundException(`Voucher ${voucherId} not found`);
    if (voucher.status === VoucherStatus.REVOKED) return voucher;

    if (voucher.routerId) {
      await this.routerApiService.disconnectActiveSessionsByUsername(
        voucher.routerId,
        voucher.code,
      );
      await this.routerApiService.removeHotspotUser(
        voucher.routerId,
        voucher.code,
      );
    }

    await this.prisma.session.updateMany({
      where: {
        voucherId,
        status: SessionStatus.ACTIVE,
      },
      data: {
        status: SessionStatus.TERMINATED,
        terminatedAt: new Date(),
        terminateReason: "voucher_revoked",
      },
    });

    return this.prisma.voucher.update({
      where: { id: voucherId },
      data: { status: VoucherStatus.REVOKED, revokedAt: new Date() },
    });
  }

  async redeliverVoucher(
    voucherId: string,
  ): Promise<{ queued: boolean; voucherId: string }> {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
      include: { plan: true, router: true },
    });

    if (!voucher) throw new NotFoundException(`Voucher ${voucherId} not found`);
    if (!voucher.routerId) {
      throw new ConflictException("Voucher has no assigned router");
    }
    if (
      voucher.status === VoucherStatus.REVOKED ||
      voucher.status === VoucherStatus.EXPIRED
    ) {
      throw new ConflictException(
        `Voucher cannot be re-delivered in status ${voucher.status}`,
      );
    }

    await this.prisma.voucher.update({
      where: { id: voucherId },
      data: {
        status: VoucherStatus.GENERATED,
        lastDeliveryError: null,
      },
    });

    await this.queueService.enqueueVoucherDelivery({
      voucherId,
      routerId: voucher.routerId,
    });

    this.logger.log(`Voucher ${voucherId} queued again for delivery`);

    return { queued: true, voucherId };
  }

  async deleteVoucher(
    voucherId: string,
    actor: { sub: string; role: UserRole },
  ): Promise<{ deleted: true; voucherId: string }> {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id: voucherId },
      include: {
        session: true,
      },
    });

    if (!voucher) {
      throw new NotFoundException(`Voucher ${voucherId} not found`);
    }
    ensureVoucherCanBeDeleted(voucher, actor);
    await this.performSafeVoucherDelete(voucher, actor);

    return {
      deleted: true,
      voucherId,
    };
  }

  async bulkDeleteVouchers(
    voucherIds: string[],
    actor: { sub: string; role: UserRole },
  ): Promise<VoucherBulkDeleteResult> {
    const uniqueVoucherIds = Array.from(
      new Set(
        voucherIds.filter((voucherId): voucherId is string =>
          Boolean(voucherId?.trim()),
        ),
      ),
    );

    if (uniqueVoucherIds.length === 0) {
      return {
        requestedCount: 0,
        deletedCount: 0,
        skippedCount: 0,
        deleted: [],
        skipped: [],
      };
    }

    const vouchers = await this.prisma.voucher.findMany({
      where: {
        id: {
          in: uniqueVoucherIds,
        },
      },
      include: {
        session: true,
      },
    });

    const vouchersById = new Map(
      vouchers.map((voucher) => [voucher.id, voucher]),
    );
    const deleted: VoucherBulkDeleteResult["deleted"] = [];
    const skipped: VoucherBulkDeleteResult["skipped"] = [];

    for (const voucherId of uniqueVoucherIds) {
      const voucher = vouchersById.get(voucherId);

      if (!voucher) {
        skipped.push({
          voucherId,
          code: null,
          reason: "Ticket introuvable dans la base.",
        });
        continue;
      }

      try {
        ensureVoucherCanBeDeleted(voucher, actor);
        await this.performSafeVoucherDelete(voucher, actor);
        deleted.push({
          voucherId,
          code: voucher.code,
        });
      } catch (error) {
        skipped.push({
          voucherId,
          code: voucher.code,
          reason: getBulkDeleteFailureReason(error),
        });
      }
    }

    return {
      requestedCount: uniqueVoucherIds.length,
      deletedCount: deleted.length,
      skippedCount: skipped.length,
      deleted,
      skipped,
    };
  }

  // ---------------------------------------------------------------------------
  // Data for PDF export
  // ---------------------------------------------------------------------------

  async getVouchersForPdf(
    voucherIds: string[],
    actor: { sub: string; role: UserRole },
  ): Promise<
    {
      code: string;
      password: string;
      planName: string;
      durationMinutes: number;
      priceXof: number;
      routerName?: string | null;
      createdAt: Date;
    }[]
  > {
    const tenantScope = scopeVoucherToOwner(actor.sub, actor.role);
    const vouchers = await this.prisma.voucher.findMany({
      where: { id: { in: voucherIds }, ...tenantScope },
      include: {
        plan: true,
        router: {
          select: {
            name: true,
          },
        },
      },
    });

    return vouchers.map((v) => ({
      code: v.code,
      password: v.passwordPlain,
      planName: v.plan.name,
      durationMinutes: v.plan.durationMinutes,
      priceXof: v.plan.priceXof,
      routerName: v.router?.name ?? null,
      createdAt: v.createdAt,
    }));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async generateUniqueCode(options: {
    codeLength: number;
    prefix?: string;
    numericOnly?: boolean;
  }): Promise<string> {
    for (let attempt = 0; attempt < COLLISION_MAX_RETRIES; attempt++) {
      const code = this.generateCode(options);
      const existing = await this.prisma.voucher.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!existing) return code;
      this.logger.warn(
        `Voucher code collision (attempt ${attempt + 1}): ${code}`,
      );
    }
    throw new ConflictException("Failed to generate unique voucher code");
  }

  private generateCode(options: {
    codeLength: number;
    prefix?: string;
    numericOnly?: boolean;
  }): string {
    const codeLength = normalizeCodeLength(
      options.codeLength,
      this.defaultCodeLength,
    );
    const prefix = normalizeTicketPrefix(options.prefix);
    const numericOnly = Boolean(options.numericOnly);
    const core = this.generateCredential(codeLength, numericOnly);

    if (shouldUseGroupedFormat(prefix, numericOnly, this.voucherPrefix)) {
      return [prefix.toUpperCase(), ...chunkCode(core.toUpperCase())].join("-");
    }

    if (prefix) {
      return `${prefix}${core}`;
    }

    if (numericOnly) {
      return core;
    }

    return chunkCode(core.toUpperCase()).join("-");
  }

  private generateCredential(length: number, numericOnly: boolean): string {
    const bytes = randomBytes(length);
    const charset = numericOnly ? NUMERIC_CHARSET : CODE_CHARSET;
    let credential = "";

    for (let i = 0; i < length; i++) {
      credential += charset[bytes[i]! % charset.length];
    }

    return credential;
  }

  private async performSafeVoucherDelete(
    voucher: Pick<
      Voucher,
      "id" | "code" | "planId" | "routerId" | "status" | "createdById"
    >,
    actor: { sub: string; role: UserRole },
  ) {
    if (
      voucher.routerId &&
      (voucher.status === VoucherStatus.DELIVERED ||
        voucher.status === VoucherStatus.REVOKED)
    ) {
      await this.runBestEffortRouterCleanup(
        voucher.routerId,
        voucher.code,
        "disconnect_active_sessions",
        () =>
          this.routerApiService.disconnectActiveSessionsByUsername(
            voucher.routerId!,
            voucher.code,
          ),
      );
      await this.runBestEffortRouterCleanup(
        voucher.routerId,
        voucher.code,
        "remove_hotspot_user",
        () =>
          this.routerApiService.removeHotspotUser(
            voucher.routerId!,
            voucher.code,
          ),
      );
    }

    await this.prisma.voucher.delete({
      where: { id: voucher.id },
    });

    await this.auditService.log({
      userId: actor.sub,
      action: AuditAction.DELETE,
      entityType: "Voucher",
      entityId: voucher.id,
      oldValues: {
        code: voucher.code,
        planId: voucher.planId,
        routerId: voucher.routerId,
        status: voucher.status,
        createdById: voucher.createdById,
      },
      description: `Voucher ${voucher.code} deleted safely`,
    });
  }

  private async runBestEffortRouterCleanup(
    routerId: string | null,
    code: string,
    action: string,
    cleanupFn: () => Promise<unknown>,
  ) {
    if (!routerId) {
      return;
    }

    try {
      await cleanupFn();
    } catch (error) {
      const reason =
        error instanceof Error && error.message.trim()
          ? error.message
          : "unknown router cleanup failure";
      this.logger.warn(
        `Voucher ${code} deleted despite router cleanup failure (${action}) on router ${routerId}: ${reason}`,
      );
    }
  }
}
