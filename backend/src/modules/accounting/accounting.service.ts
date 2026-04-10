import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InvoiceType, InvoiceStatus, UserRole } from "@prisma/client";

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate next invoice number for a user in the format INV-YYYY-NNNN
   */
  private async generateInvoiceNumber(userId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    // Count invoices for this user in the current year
    const count = await this.prisma.invoice.count({
      where: {
        userId,
        number: { startsWith: prefix },
      },
    });

    const sequence = String(count + 1).padStart(4, "0");
    return `${prefix}${sequence}`;
  }

  async generateInvoice(userId: string, periodStart: Date, periodEnd: Date) {
    // Aggregate successful transactions in the period
    const transactions = await this.prisma.transaction.findMany({
      where: {
        status: "COMPLETED",
        paidAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        plan: {
          vouchers: {
            some: {
              router: {
                ownerId: userId,
              },
            },
          },
        },
      },
      include: {
        plan: { select: { name: true, priceXof: true } },
      },
    });

    const subtotalXof = transactions.reduce((sum, tx) => sum + tx.amountXof, 0);
    const taxXof = 0; // Tax-exempt or handled separately
    const totalXof = subtotalXof + taxXof;

    const lineItems = transactions.map((tx) => ({
      description: `${tx.plan?.name ?? "Plan"} — ${tx.reference}`,
      quantity: 1,
      unitPriceXof: tx.amountXof,
      totalXof: tx.amountXof,
      date: tx.paidAt,
    }));

    const number = await this.generateInvoiceNumber(userId);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    return this.prisma.invoice.create({
      data: {
        number,
        userId,
        type: InvoiceType.PLATFORM_FEE,
        status: InvoiceStatus.DRAFT,
        subtotalXof,
        taxXof,
        totalXof,
        periodStart,
        periodEnd,
        dueDate,
        lineItems,
        metadata: {
          transactionCount: transactions.length,
          generatedAt: new Date().toISOString(),
        },
      },
    });
  }

  async findInvoices(userId: string, page = 1, limit = 20) {
    const skip = (Math.max(1, page) - 1) * Math.min(limit, 50);
    const where = { userId };

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: Math.min(limit, 50),
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getInvoice(id: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, userId },
    });

    if (!invoice) {
      throw new NotFoundException("Facture introuvable.");
    }

    return invoice;
  }

  async generateInvoicePdf(id: string, userId: string): Promise<Buffer> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, userId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!invoice) throw new NotFoundException("Facture introuvable.");

    interface PdfDoc {
      on(event: string, cb: (chunk: Buffer) => void): void;
      end(): void;
      font(f: string): PdfDoc;
      fontSize(s: number): PdfDoc;
      text(t: string, x?: number, y?: number, opts?: object): PdfDoc;
      moveDown(n?: number): PdfDoc;
      moveTo(x: number, y: number): PdfDoc;
      lineTo(x: number, y: number): PdfDoc;
      stroke(): PdfDoc;
      strokeColor(c: string): PdfDoc;
      lineWidth(w: number): PdfDoc;
      fillColor(c: string): PdfDoc;
      rect(x: number, y: number, w: number, h: number): PdfDoc;
      fill(c?: string): PdfDoc;
      pipe(dest: unknown): void;
    }

    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const PDFDocument = require("pdfkit") as new (opts?: object) => PdfDoc;

      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const formatAmount = (n: number) =>
        new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0 }).format(n) +
        " FCFA";

      // --- Header ---
      doc
        .fillColor("#6366f1")
        .fontSize(22)
        .font("Helvetica-Bold")
        .text("MikroServer", 50, 50);
      doc
        .fillColor("#888")
        .fontSize(10)
        .font("Helvetica")
        .text("Plateforme de monétisation WiFi", 50, 78);

      doc
        .fillColor("#111")
        .fontSize(28)
        .font("Helvetica-Bold")
        .text("FACTURE", 350, 50, { align: "right" });
      doc
        .fillColor("#444")
        .fontSize(10)
        .font("Helvetica")
        .text(`N° ${invoice.number}`, 350, 86, { align: "right" });

      // Separator
      doc
        .moveTo(50, 110)
        .lineTo(545, 110)
        .strokeColor("#e2e8f0")
        .lineWidth(1)
        .stroke();

      // --- Invoice metadata ---
      const metaY = 125;
      doc.fillColor("#888").fontSize(9).text("DATE", 50, metaY);
      doc
        .fillColor("#111")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(
          new Date(invoice.createdAt).toLocaleDateString("fr-FR"),
          50,
          metaY + 14,
        );

      if (invoice.dueDate) {
        doc
          .fillColor("#888")
          .fontSize(9)
          .font("Helvetica")
          .text("ÉCHÉANCE", 180, metaY);
        doc
          .fillColor("#111")
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(
            new Date(invoice.dueDate).toLocaleDateString("fr-FR"),
            180,
            metaY + 14,
          );
      }

      if (invoice.periodStart && invoice.periodEnd) {
        doc
          .fillColor("#888")
          .fontSize(9)
          .font("Helvetica")
          .text("PÉRIODE", 310, metaY);
        doc
          .fillColor("#111")
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(
            `${new Date(invoice.periodStart).toLocaleDateString("fr-FR")} – ${new Date(invoice.periodEnd).toLocaleDateString("fr-FR")}`,
            310,
            metaY + 14,
          );
      }

      // --- Billed to ---
      const billY = 175;
      doc
        .fillColor("#888")
        .fontSize(9)
        .font("Helvetica")
        .text("FACTURÉ À", 50, billY);
      doc
        .fillColor("#111")
        .fontSize(11)
        .font("Helvetica-Bold")
        .text(
          `${invoice.user.firstName} ${invoice.user.lastName}`,
          50,
          billY + 14,
        );
      doc
        .fillColor("#444")
        .fontSize(10)
        .font("Helvetica")
        .text(invoice.user.email, 50, billY + 30);

      // --- Status badge ---
      const statusColors: Record<string, string> = {
        PAID: "#22c55e",
        DRAFT: "#94a3b8",
        SENT: "#3b82f6",
        OVERDUE: "#ef4444",
      };
      const statusColor = statusColors[invoice.status] ?? "#94a3b8";
      doc
        .fillColor(statusColor)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(invoice.status, 400, billY + 14);

      // Separator
      doc
        .moveTo(50, 230)
        .lineTo(545, 230)
        .strokeColor("#e2e8f0")
        .lineWidth(1)
        .stroke();

      // --- Line items table header ---
      const tableY = 245;
      doc.fillColor("#f8fafc").rect(50, tableY, 495, 22).fill();
      doc.fillColor("#555").fontSize(9).font("Helvetica-Bold");
      doc.text("DESCRIPTION", 60, tableY + 7);
      doc.text("QTÉ", 350, tableY + 7, { align: "right", width: 50 });
      doc.text("P.U.", 405, tableY + 7, { align: "right", width: 70 });
      doc.text("TOTAL", 475, tableY + 7, { align: "right", width: 65 });

      // --- Line items ---
      type LineItem = {
        description: string;
        quantity: number;
        unitPriceXof: number;
        totalXof: number;
      };
      const lineItems = (invoice.lineItems as unknown as LineItem[]) ?? [];
      let itemY = tableY + 30;

      lineItems.forEach((item, i) => {
        if (i % 2 === 1) {
          doc
            .fillColor("#f8fafc")
            .rect(50, itemY - 5, 495, 22)
            .fill();
        }
        doc
          .fillColor("#111")
          .fontSize(10)
          .font("Helvetica")
          .text(item.description, 60, itemY);
        doc.text(String(item.quantity), 350, itemY, {
          align: "right",
          width: 50,
        });
        doc.text(formatAmount(item.unitPriceXof), 405, itemY, {
          align: "right",
          width: 70,
        });
        doc
          .font("Helvetica-Bold")
          .text(formatAmount(item.totalXof), 475, itemY, {
            align: "right",
            width: 65,
          });
        itemY += 25;
      });

      // Separator
      doc
        .moveTo(50, itemY + 5)
        .lineTo(545, itemY + 5)
        .strokeColor("#e2e8f0")
        .lineWidth(1)
        .stroke();

      // --- Totals ---
      const totalsY = itemY + 20;
      doc.fillColor("#444").fontSize(10).font("Helvetica");
      doc.text("Sous-total HT", 350, totalsY, { align: "right", width: 130 });
      doc.text(formatAmount(invoice.subtotalXof), 490, totalsY, {
        align: "right",
        width: 50,
      });

      doc.text(`TVA (18%)`, 350, totalsY + 18, { align: "right", width: 130 });
      doc.text(formatAmount(invoice.taxXof), 490, totalsY + 18, {
        align: "right",
        width: 50,
      });

      doc
        .moveTo(350, totalsY + 38)
        .lineTo(545, totalsY + 38)
        .strokeColor("#6366f1")
        .lineWidth(1.5)
        .stroke();

      doc.fillColor("#6366f1").fontSize(12).font("Helvetica-Bold");
      doc.text("TOTAL TTC", 350, totalsY + 48, { align: "right", width: 130 });
      doc.text(formatAmount(invoice.totalXof), 490, totalsY + 48, {
        align: "right",
        width: 50,
      });

      // --- Footer ---
      const footerY = 750;
      doc
        .moveTo(50, footerY)
        .lineTo(545, footerY)
        .strokeColor("#e2e8f0")
        .lineWidth(1)
        .stroke();
      doc
        .fillColor("#888")
        .fontSize(8)
        .font("Helvetica")
        .text(
          "MikroServer Platform · WiFi Monetization SaaS · Côte d'Ivoire",
          50,
          footerY + 10,
          { align: "center", width: 495 },
        );

      doc.end();
    });
  }

  async getRevenueByRouter(
    userId: string,
    userRole: UserRole,
    dateFrom: Date,
    dateTo: Date,
  ) {
    const isSuperAdmin = userRole === UserRole.SUPER_ADMIN;
    const routers = await this.prisma.router.findMany({
      where: isSuperAdmin
        ? { deletedAt: null }
        : { ownerId: userId, deletedAt: null },
      select: { id: true, name: true },
    });

    const results = await Promise.all(
      routers.map(async (router) => {
        const agg = await this.prisma.transaction.aggregate({
          where: {
            status: "COMPLETED",
            paidAt: { gte: dateFrom, lte: dateTo },
            plan: {
              vouchers: {
                some: { routerId: router.id },
              },
            },
          },
          _sum: { amountXof: true },
          _count: { id: true },
        });

        return {
          routerId: router.id,
          routerName: router.name,
          totalXof: agg._sum.amountXof ?? 0,
          transactionCount: agg._count.id,
        };
      }),
    );

    return results.sort((a, b) => b.totalXof - a.totalXof);
  }

  async getRevenueByPeriod(userId: string, userRole: UserRole, months = 12) {
    const results: Array<{
      month: string;
      year: number;
      monthNum: number;
      totalXof: number;
      transactionCount: number;
    }> = [];

    const now = new Date();
    const isSuperAdmin = userRole === UserRole.SUPER_ADMIN;

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const periodStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const periodEnd = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
        23,
        59,
        59,
      );

      const agg = await this.prisma.transaction.aggregate({
        where: {
          status: "COMPLETED",
          paidAt: { gte: periodStart, lte: periodEnd },
          ...(isSuperAdmin
            ? {}
            : {
                plan: {
                  vouchers: {
                    some: {
                      router: { ownerId: userId },
                    },
                  },
                },
              }),
        },
        _sum: { amountXof: true },
        _count: { id: true },
      });

      results.push({
        month: periodStart.toLocaleString("fr-CI", { month: "long" }),
        year: periodStart.getFullYear(),
        monthNum: periodStart.getMonth() + 1,
        totalXof: agg._sum.amountXof ?? 0,
        transactionCount: agg._count.id,
      });
    }

    return results;
  }
}
