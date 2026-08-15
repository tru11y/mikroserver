import { SaasTier } from "@prisma/client";

export type TierDto = {
  id: string;
  key: string;
  name: string;
  monthlyXof: number;
  annualMonthlyXof: number;
  annualDiscount: number;
  routerLimit: number | null;
  remoteAccess: boolean;
  a4Printing: boolean;
  cloudBackup: boolean;
  prioritySupport: boolean;
  badge: string | null;
  tagline: string | null;
  features: { label: string; included: boolean }[];
  displayOrder: number;
  active: boolean;
};

export function toTierDto(tier: SaasTier): TierDto {
  const annualMonthlyXof = tier.priceXofYearly
    ? Math.round(tier.priceXofYearly / 12)
    : tier.priceXofMonthly;
  const annualDiscount =
    tier.priceXofYearly && tier.priceXofMonthly > 0
      ? Math.round(
          (1 - tier.priceXofYearly / 12 / tier.priceXofMonthly) * 100,
        )
      : 0;
  const isPaid = !tier.isFree;

  return {
    id: tier.id,
    key: tier.slug,
    name: tier.name,
    monthlyXof: tier.priceXofMonthly,
    annualMonthlyXof,
    annualDiscount,
    routerLimit: tier.maxRouters,
    remoteAccess: isPaid,
    a4Printing: isPaid,
    cloudBackup: isPaid,
    prioritySupport: isPaid,
    badge: null,
    tagline: tier.description,
    features: (Array.isArray(tier.features) ? (tier.features as string[]) : []).map(
      (label) => ({ label, included: true }),
    ),
    displayOrder: tier.displayOrder,
    active: tier.isActive,
  };
}
