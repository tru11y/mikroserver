import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { Plan, PlanStatus, AuditAction } from '@prisma/client';

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(includeArchived = false): Promise<Plan[]> {
    return this.prisma.plan.findMany({
      where: {
        deletedAt: null,
        ...(includeArchived ? {} : { status: PlanStatus.ACTIVE }),
      },
      orderBy: [{ displayOrder: 'asc' }, { priceXof: 'asc' }],
    });
  }

  async findOne(id: string): Promise<Plan> {
    const plan = await this.prisma.plan.findUnique({
      where: { id, deletedAt: null },
    });

    if (!plan) throw new NotFoundException(`Plan ${id} not found`);
    return plan;
  }

  async create(dto: CreatePlanDto, adminId: string): Promise<Plan> {
    const slug = dto.slug ?? dto.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 120);

    const existing = await this.prisma.plan.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException(`Plan slug "${slug}" already exists`);
    }

    const plan = await this.prisma.plan.create({ data: { ...dto, slug } });

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.CREATE,
      entityType: 'Plan',
      entityId: plan.id,
      newValues: dto,
      description: `Plan "${plan.name}" created`,
    });

    return plan;
  }

  async update(id: string, dto: UpdatePlanDto, adminId: string): Promise<Plan> {
    const existing = await this.findOne(id);

    const updated = await this.prisma.plan.update({
      where: { id },
      data: dto,
    });

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.UPDATE,
      entityType: 'Plan',
      entityId: id,
      oldValues: existing,
      newValues: dto,
    });

    return updated;
  }

  async archive(id: string, adminId: string): Promise<Plan> {
    const plan = await this.findOne(id);

    const updated = await this.prisma.plan.update({
      where: { id },
      data: { status: PlanStatus.ARCHIVED, deletedAt: new Date() },
    });

    await this.auditService.log({
      userId: adminId,
      action: AuditAction.DELETE,
      entityType: 'Plan',
      entityId: id,
      description: `Plan "${plan.name}" archived`,
    });

    return updated;
  }
}
