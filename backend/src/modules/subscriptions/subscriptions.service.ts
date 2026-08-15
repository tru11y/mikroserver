import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { toTierDto, TierDto } from "../saas/tier.mapper";

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listTiers(): Promise<TierDto[]> {
    const tiers = await this.prisma.saasTier.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    });
    return tiers.map(toTierDto);
  }

  async requestUpgrade(
    userId: string,
    params: {
      note?: string;
      tierKey?: string;
      billingPeriod?: "MONTHLY" | "ANNUAL";
    },
  ) {
    const billingPeriod = params.billingPeriod ?? "MONTHLY";
    const tier = params.tierKey
      ? await this.prisma.saasTier.findUnique({
          where: { slug: params.tierKey },
        })
      : await this.prisma.saasTier.findFirst({
          where: { isFree: false, isActive: true },
          orderBy: { displayOrder: "asc" },
        });
    if (!tier) throw new NotFoundException("Tier SaaS introuvable");

    const amount =
      billingPeriod === "ANNUAL"
        ? (tier.priceXofYearly ?? tier.priceXofMonthly * 12)
        : tier.priceXofMonthly;
    const periodDays = billingPeriod === "ANNUAL" ? 365 : 30;

    const number = `UPG-${Date.now()}`;
    const invoice = await this.prisma.invoice.create({
      data: {
        number,
        userId,
        type: "PLATFORM_FEE",
        status: "SENT",
        subtotalXof: amount,
        totalXof: amount,
        notes: params.note ?? null,
        metadata: {
          tierKey: tier.slug,
          tierName: tier.name,
          billingPeriod,
          periodDays,
        },
      },
    });

    return {
      invoice: {
        id: invoice.id,
        amount: invoice.totalXof,
        currency: "XOF",
        status: invoice.status,
        tierKey: tier.slug,
        tierName: tier.name,
        billingPeriod,
      },
      instructions:
        "Un conseiller va confirmer votre paiement et activer votre abonnement sous peu.",
    };
  }
}
