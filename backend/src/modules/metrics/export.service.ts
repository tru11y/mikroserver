import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Export transactions as CSV string
   */
  async exportTransactionsCsv(
    userId: string,
    userRole: string,
    dateFrom?: Date,
    dateTo?: Date,
  ): Promise<string> {
    const isAdmin = userRole === "ADMIN";

    const where = {
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };

    const txs = await this.prisma.transaction.findMany({
      where,
      include: {
        plan: { select: { name: true } },
        voucher: {
          select: {
            routerId: true,
            router: { select: { name: true, ownerId: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    // Filter by ownership for ADMIN
    const filtered = isAdmin
      ? txs.filter(
          (t) =>
            !t.voucher?.router?.ownerId || t.voucher.router.ownerId === userId,
        )
      : txs;

    const header =
      "Référence,Date,Statut,Montant (FCFA),Plan,Téléphone,Routeur,Fournisseur";
    const rows = filtered.map((t) =>
      [
        t.reference,
        t.createdAt.toISOString(),
        t.status,
        t.amountXof,
        `"${t.plan?.name ?? ""}"`,
        t.customerPhone,
        `"${t.voucher?.router?.name ?? ""}"`,
        t.provider,
      ].join(","),
    );

    return [header, ...rows].join("\n");
  }

  /**
   * Export customer profiles as CSV
   */
  async exportCustomersCsv(userId: string, userRole: string): Promise<string> {
    const isAdmin = userRole === "ADMIN";

    const profiles = await this.prisma.customerProfile.findMany({
      where: isAdmin ? { router: { ownerId: userId } } : {},
      include: { router: { select: { name: true } } },
      orderBy: { lastSeenAt: "desc" },
      take: 10000,
    });

    const header =
      "MAC Address,Prénom,Nom,Téléphone,Routeur,Première connexion,Dernière activité,Sessions totales,Data (MB)";
    const rows = profiles.map((p) =>
      [
        p.macAddress,
        p.firstName ?? "",
        p.lastName ?? "",
        p.phone ?? "",
        `"${p.router.name}"`,
        p.firstSeenAt.toISOString(),
        p.lastSeenAt.toISOString(),
        p.totalSessions,
        (Number(p.totalDataBytes) / 1024 / 1024).toFixed(2),
      ].join(","),
    );

    return [header, ...rows].join("\n");
  }
}
