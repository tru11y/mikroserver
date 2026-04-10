import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { createHash, randomBytes } from "crypto";

export interface CreateApiKeyDto {
  name: string;
  permissions: string[];
  expiresAt?: Date;
}

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  private hashKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
  }

  async create(userId: string, dto: CreateApiKeyDto) {
    const rawKey = "msk_" + randomBytes(32).toString("hex"); // "msk_" prefix + 64 hex chars
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 12); // "msk_" + 8 chars

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        keyHash,
        keyPrefix,
        permissions: dto.permissions,
        expiresAt: dto.expiresAt,
      },
    });

    return { ...apiKey, rawKey }; // rawKey shown ONCE, never stored
  }

  async findAll(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async revoke(id: string, userId: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, userId } });
    if (!key) throw new NotFoundException("API key not found");
    return this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date(), isActive: false },
    });
  }

  async validateKey(
    rawKey: string,
  ): Promise<{ userId: string; permissions: string[] } | null> {
    const hash = this.hashKey(rawKey);
    const key = await this.prisma.apiKey.findFirst({
      where: { keyHash: hash, isActive: true, revokedAt: null },
    });
    if (!key) return null;
    if (key.expiresAt && key.expiresAt < new Date()) return null;

    // Update lastUsedAt (fire and forget)
    this.prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});

    return { userId: key.userId, permissions: key.permissions };
  }
}
