import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { scopeCustomerProfileToOwner } from "../../common/helpers/tenant-scope.helper";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertFromSession(
    macAddress: string,
    routerId: string,
    username: string,
  ) {
    const now = new Date();
    return this.prisma.customerProfile.upsert({
      where: { macAddress_routerId: { macAddress, routerId } },
      create: {
        macAddress,
        routerId,
        lastUsername: username,
        firstSeenAt: now,
        lastSeenAt: now,
        totalSessions: 1,
      },
      update: {
        lastUsername: username,
        lastSeenAt: now,
        totalSessions: { increment: 1 },
      },
    });
  }

  async findAll(
    routerId?: string,
    page = 1,
    limit = 25,
    search?: string,
    requestingUserId?: string,
    requestingUserRole?: string,
  ) {
    const skip = (Math.max(1, page) - 1) * Math.min(limit, 100);
    const ownerFilter =
      requestingUserId && requestingUserRole
        ? scopeCustomerProfileToOwner(
            requestingUserId,
            requestingUserRole as UserRole,
          )
        : {};

    const where = {
      ...(routerId ? { routerId } : {}),
      ...ownerFilter,
      ...(search
        ? {
            OR: [
              {
                macAddress: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                lastUsername: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              { phone: { contains: search, mode: "insensitive" as const } },
              {
                firstName: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                lastName: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.customerProfile.findMany({
        where,
        orderBy: { lastSeenAt: "desc" },
        skip,
        take: Math.min(limit, 100),
        include: {
          router: { select: { id: true, name: true } },
        },
      }),
      this.prisma.customerProfile.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string, requestingUserId: string, requestingUserRole: UserRole) {
    return this.prisma.customerProfile.findFirstOrThrow({
      where: { id, ...scopeCustomerProfileToOwner(requestingUserId, requestingUserRole) },
      include: { router: { select: { id: true, name: true } } },
    });
  }

  async update(
    id: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      notes?: string;
    },
    requestingUserId: string,
    requestingUserRole: UserRole,
  ) {
    await this.prisma.customerProfile.findFirstOrThrow({
      where: { id, ...scopeCustomerProfileToOwner(requestingUserId, requestingUserRole) },
    });
    return this.prisma.customerProfile.update({ where: { id }, data });
  }

  async block(id: string, isBlocked: boolean, requestingUserId: string, requestingUserRole: UserRole) {
    await this.prisma.customerProfile.findFirstOrThrow({
      where: { id, ...scopeCustomerProfileToOwner(requestingUserId, requestingUserRole) },
    });
    return this.prisma.customerProfile.update({
      where: { id },
      data: { isBlocked },
    });
  }

  async remove(id: string, requestingUserId: string, requestingUserRole: UserRole) {
    await this.prisma.customerProfile.findFirstOrThrow({
      where: { id, ...scopeCustomerProfileToOwner(requestingUserId, requestingUserRole) },
    });
    await this.prisma.customerProfile.delete({ where: { id } });
  }

  async getStats(
    routerId?: string,
    requestingUserId?: string,
    requestingUserRole?: string,
  ) {
    const ownerFilter =
      requestingUserId && requestingUserRole
        ? scopeCustomerProfileToOwner(
            requestingUserId,
            requestingUserRole as UserRole,
          )
        : {};

    const where = {
      ...(routerId ? { routerId } : {}),
      ...ownerFilter,
    };
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [total, newThisWeek, active] = await Promise.all([
      this.prisma.customerProfile.count({ where }),
      this.prisma.customerProfile.count({
        where: { ...where, firstSeenAt: { gte: weekAgo } },
      }),
      this.prisma.customerProfile.count({
        where: { ...where, lastSeenAt: { gte: weekAgo } },
      }),
    ]);

    return { total, newThisWeek, activeThisWeek: active };
  }
}
