import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreatePlanDto, UpdatePlanDto } from "./dto/plan.dto";
import { Plan, PlanStatus, AuditAction, Prisma, UserRole } from "@prisma/client";

export interface PlanActor {
  sub: string;
  role: UserRole;
}
import {
  PlanTicketSettings,
  PlanTicketSettingsInput,
  buildDefaultPlanTicketSettings,
  normalizePlanTicketSettings,
} from "./plan-ticket-settings";

export interface PublicPlanCatalogItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  priceXof: number;
  downloadKbps: number | null;
  uploadKbps: number | null;
  dataLimitMb: number | null;
  isPopular: boolean;
  ticketSettings: PlanTicketSettings;
}

@Injectable()
export class PlansService {
  private readonly voucherPrefix: string;
  private readonly defaultCodeLength: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {
    this.voucherPrefix = this.configService.get<string>(
      "mikrotik.voucherPrefix",
      "MS",
    );
    this.defaultCodeLength = this.configService.get<number>(
      "MIKROTIK_VOUCHER_CODE_LENGTH",
      12,
    );
  }

  async findAll(
    includeArchived = false,
    actor?: PlanActor,
  ): Promise<Array<Plan & { ticketSettings: PlanTicketSettings }>> {
    const ownerScope =
      !actor || actor.role === UserRole.SUPER_ADMIN
        ? {}
        : { ownerId: actor.sub };

    const plans = await this.prisma.plan.findMany({
      where: includeArchived
        ? ownerScope
        : {
            deletedAt: null,
            status: PlanStatus.ACTIVE,
            ...ownerScope,
          },
      orderBy: [{ displayOrder: "asc" }, { priceXof: "asc" }],
    });

    return plans.map((plan) => this.decoratePlan(plan));
  }

  async findPublicCatalog(): Promise<PublicPlanCatalogItem[]> {
    const plans = await this.prisma.plan.findMany({
      where: {
        deletedAt: null,
        status: PlanStatus.ACTIVE,
      },
      orderBy: [{ displayOrder: "asc" }, { priceXof: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        durationMinutes: true,
        priceXof: true,
        downloadKbps: true,
        uploadKbps: true,
        dataLimitMb: true,
        isPopular: true,
        metadata: true,
      },
    });

    return plans.map((plan) => ({
      ...plan,
      ticketSettings: this.getTicketSettings(plan.metadata),
    }));
  }

  async findOne(
    id: string,
    actor?: PlanActor,
  ): Promise<Plan & { ticketSettings: PlanTicketSettings }> {
    const ownerScope =
      !actor || actor.role === UserRole.SUPER_ADMIN
        ? {}
        : { ownerId: actor.sub };

    const plan = await this.prisma.plan.findFirst({
      where: { id, deletedAt: null, ...ownerScope },
    });

    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return this.decoratePlan(plan);
  }

  async create(
    dto: CreatePlanDto,
    actor: PlanActor,
  ): Promise<Plan & { ticketSettings: PlanTicketSettings }> {
    const slug =
      dto.slug ??
      dto.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 120);

    const ownerId =
      actor.role === UserRole.SUPER_ADMIN ? null : actor.sub;

    // Composite uniqueness check: same slug can exist for different operators
    const existing = await this.prisma.plan.findFirst({
      where: { slug, ownerId },
    });
    if (existing) {
      throw new ConflictException(`Plan slug "${slug}" already exists`);
    }

    const payload = this.buildPlanPayload(dto, slug) as Prisma.PlanCreateInput;
    const data: Prisma.PlanCreateInput = { ...payload, ownerId };
    const plan = await this.prisma.plan.create({ data });

    await this.auditService.log({
      userId: actor.sub,
      action: AuditAction.CREATE,
      entityType: "Plan",
      entityId: plan.id,
      newValues: data,
      description: `Plan "${plan.name}" created`,
    });

    return this.decoratePlan(plan);
  }

  async update(
    id: string,
    dto: UpdatePlanDto,
    actor: PlanActor,
  ): Promise<Plan & { ticketSettings: PlanTicketSettings }> {
    const existing = await this.findOne(id, actor);
    const data = this.buildPlanPayload(
      dto,
      undefined,
      existing.metadata,
    ) as Prisma.PlanUpdateInput;

    const updated = await this.prisma.plan.update({
      where: { id },
      data,
    });

    await this.auditService.log({
      userId: actor.sub,
      action: AuditAction.UPDATE,
      entityType: "Plan",
      entityId: id,
      oldValues: existing,
      newValues: data,
    });

    return this.decoratePlan(updated);
  }

  async archive(
    id: string,
    actor: PlanActor,
  ): Promise<Plan & { ticketSettings: PlanTicketSettings }> {
    const plan = await this.findOne(id, actor);

    const updated = await this.prisma.plan.update({
      where: { id },
      data: { status: PlanStatus.ARCHIVED, deletedAt: new Date() },
    });

    await this.auditService.log({
      userId: actor.sub,
      action: AuditAction.DELETE,
      entityType: "Plan",
      entityId: id,
      description: `Plan "${plan.name}" archived`,
    });

    return this.decoratePlan(updated);
  }

  async restore(
    id: string,
    actor: PlanActor,
  ): Promise<Plan & { ticketSettings: PlanTicketSettings }> {
    const ownerScope =
      actor.role === UserRole.SUPER_ADMIN ? {} : { ownerId: actor.sub };

    const plan = await this.prisma.plan.findFirst({ where: { id, ...ownerScope } });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    if (plan.status !== PlanStatus.ARCHIVED) {
      throw new ConflictException(`Plan ${id} is not archived`);
    }

    const updated = await this.prisma.plan.update({
      where: { id },
      data: { status: PlanStatus.ACTIVE, deletedAt: null },
    });

    await this.auditService.log({
      userId: actor.sub,
      action: AuditAction.UPDATE,
      entityType: "Plan",
      entityId: id,
      description: `Plan "${plan.name}" restored`,
    });

    return this.decoratePlan(updated);
  }

  private decoratePlan(
    plan: Plan,
  ): Plan & { ticketSettings: PlanTicketSettings } {
    return {
      ...plan,
      ticketSettings: this.getTicketSettings(plan.metadata),
    };
  }

  private getTicketSettings(metadata: unknown): PlanTicketSettings {
    const currentMetadata = this.normalizeMetadata(metadata);
    return normalizePlanTicketSettings(
      currentMetadata["ticketSettings"] as PlanTicketSettingsInput,
      buildDefaultPlanTicketSettings(
        this.voucherPrefix,
        this.defaultCodeLength,
      ),
    );
  }

  private buildPlanPayload(
    dto: CreatePlanDto | UpdatePlanDto,
    slug?: string,
    existingMetadata?: unknown,
  ): Record<string, unknown> {
    const {
      ticketType,
      durationMode,
      usersPerTicket,
      ticketPrefix,
      ticketCodeLength,
      ticketNumericOnly,
      ticketPasswordLength,
      ticketPasswordNumericOnly,
      ...planData
    } = dto;

    const metadata = this.normalizeMetadata(existingMetadata);
    const nextTicketSettings = normalizePlanTicketSettings(
      {
        ...(metadata["ticketSettings"] as Record<string, unknown> | undefined),
        ticketType,
        durationMode,
        usersPerTicket,
        ticketPrefix,
        ticketCodeLength,
        ticketNumericOnly,
        ticketPasswordLength,
        ticketPasswordNumericOnly,
      },
      buildDefaultPlanTicketSettings(
        this.voucherPrefix,
        this.defaultCodeLength,
      ),
    );

    return {
      ...planData,
      ...(slug ? { slug } : {}),
      metadata: {
        ...metadata,
        ticketSettings: nextTicketSettings,
      },
    };
  }

  private normalizeMetadata(metadata: unknown): Record<string, unknown> {
    if (
      typeof metadata === "object" &&
      metadata !== null &&
      !Array.isArray(metadata)
    ) {
      return metadata as Record<string, unknown>;
    }

    return {};
  }
}
