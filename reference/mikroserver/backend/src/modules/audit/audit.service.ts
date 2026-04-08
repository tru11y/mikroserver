import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction } from '@prisma/client';

export interface AuditLogInput {
  userId?: string;
  auditedById?: string;
  routerId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  description?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId,
          auditedById: input.auditedById,
          routerId: input.routerId,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          oldValues: input.oldValues as object | undefined,
          newValues: input.newValues as object | undefined,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          requestId: input.requestId,
          description: input.description,
        },
      });
    } catch (error) {
      // Audit logging must NEVER fail the main operation
      this.logger.error(`Failed to write audit log: ${String(error)}`, {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
      });
    }
  }
}
