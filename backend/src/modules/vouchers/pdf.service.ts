import { Injectable, Logger } from "@nestjs/common";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import axios from "axios";
import { SettingsService } from "../settings/settings.service";

interface VoucherTicket {
  code: string;
  password: string;
  planName: string;
  durationMinutes: number;
  priceXof: number;
  routerName?: string | null;
  createdAt: Date;
}

interface TicketPrintSettings {
  enterpriseName: string;
  showEnterpriseName: boolean;
  showWifiName: boolean;
  wifiSsid: string;
  showPrice: boolean;
  currencySymbol: string;
  showTicketNumber: boolean;
  showQrCode: boolean;
  showPlanName: boolean;
  showCreatedAt: boolean;
  showDnsName: boolean;
  dnsName: string;
  keepTicketNotice: boolean;
  showLogo: boolean;
  logoUrl: string;
  ticketsPerPage: 10 | 25 | 50;
}

interface PreparedTicket {
  ticket: VoucherTicket;
  qrBuffer: Buffer | null;
}

interface PdfRenderOptions {
  includeQrCode?: boolean;
  ticketsPerPage?: number;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(private readonly settingsService: SettingsService) {}

  async generateVoucherSheet(
    tickets: VoucherTicket[],
    businessName?: string,
    options?: PdfRenderOptions,
  ): Promise<Buffer> {
    const doc = new PDFDocument({
      size: "A4",
      margin: 28,
      info: {
        Title: "MikroServer tickets",
        Author: "MikroServer",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );

    const settings = await this.loadSettings(businessName);
    const includeQrCode = options?.includeQrCode ?? settings.showQrCode;
    const ticketsPerPage = this.normalizeTicketsPerPage(
      options?.ticketsPerPage ?? settings.ticketsPerPage,
    );
    const effectiveSettings: TicketPrintSettings = {
      ...settings,
      showQrCode: includeQrCode,
      ticketsPerPage,
    };
    const logoBuffer =
      settings.showLogo && settings.logoUrl
        ? await this.fetchRemoteImage(settings.logoUrl)
        : null;
    const preparedTickets = await this.prepareTickets(tickets, includeQrCode);

    if (includeQrCode) {
      this.renderDetailedSheet(
        doc,
        preparedTickets,
        effectiveSettings,
        logoBuffer,
      );
    } else {
      this.renderCompactSheet(
        doc,
        preparedTickets,
        effectiveSettings,
        ticketsPerPage,
      );
    }

    if (preparedTickets.length === 0) {
      doc.fontSize(14).text("No ticket selected.", { align: "center" });
    }

    return new Promise<Buffer>((resolve, reject) => {
      doc.once("end", () => resolve(Buffer.concat(chunks)));
      doc.once("error", reject);
      doc.end();
    });
  }

  // ---------------------------------------------------------------------------
  // Batch sheet — 6 cards per A4 page (2 columns × 3 rows), QR code layout
  // ---------------------------------------------------------------------------

  async generateBatchSheet(tickets: VoucherTicket[]): Promise<Buffer> {
    const doc = new PDFDocument({
      size: "A4",
      margin: 20,
      info: {
        Title: "MikroServer — lot de tickets",
        Author: "MikroServer",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );

    const preparedTickets = await this.prepareTickets(tickets, true);

    // A4 at 72dpi: 595 × 842 pt. 1mm ≈ 2.835 pt
    const MM = 2.835;
    const margin = 20; // pt (≈ 7mm)
    const columns = 2;
    const rows = 3;
    const columnGap = 10;
    const rowGap = 10;
    const usableWidth = doc.page.width - margin * 2;
    const usableHeight = doc.page.height - margin * 2;
    const cardWidth = (usableWidth - columnGap * (columns - 1)) / columns; // ≈ 269 pt ≈ 95mm
    const cardHeight = (usableHeight - rowGap * (rows - 1)) / rows; // ≈ 254 pt ≈ 90mm
    const cardsPerPage = columns * rows;

    if (preparedTickets.length === 0) {
      doc.fontSize(14).text("Aucun ticket sélectionné.", { align: "center" });
    }

    preparedTickets.forEach(({ ticket, qrBuffer }, index) => {
      if (index > 0 && index % cardsPerPage === 0) {
        doc.addPage();
      }

      const indexOnPage = index % cardsPerPage;
      const col = indexOnPage % columns;
      const row = Math.floor(indexOnPage / columns);
      const x = margin + col * (cardWidth + columnGap);
      const y = margin + row * (cardHeight + rowGap);

      this.drawBatchCard(doc, {
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        ticket,
        qrBuffer,
      });
    });

    void MM; // suppress lint if unused

    return new Promise<Buffer>((resolve, reject) => {
      doc.once("end", () => resolve(Buffer.concat(chunks)));
      doc.once("error", reject);
      doc.end();
    });
  }

  private drawBatchCard(
    doc: PDFKit.PDFDocument,
    input: {
      x: number;
      y: number;
      width: number;
      height: number;
      ticket: VoucherTicket;
      qrBuffer: Buffer | null;
    },
  ): void {
    const { x, y, width, height, ticket, qrBuffer } = input;
    const pad = 10;

    // Card border
    doc.save();
    doc.roundedRect(x, y, width, height, 8).fillAndStroke("#ffffff", "#cbd5e1");
    doc.restore();

    // Platform name (top, small gray)
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor("#94a3b8")
      .text("MikroServer", x + pad, y + pad, {
        width: width - pad * 2,
        align: "center",
      });

    // Voucher code (large, monospace, centered)
    const codeY = y + pad + 16;
    doc
      .font("Courier-Bold")
      .fontSize(18)
      .fillColor("#0f172a")
      .text(ticket.code, x + pad, codeY, {
        width: width - pad * 2,
        align: "center",
      });

    // QR code (centered, 60×60 pt)
    const qrSize = 60;
    const qrX = x + (width - qrSize) / 2;
    const qrY = codeY + 30;
    if (qrBuffer) {
      try {
        doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });
      } catch (error) {
        this.logger.warn(`Unable to render batch QR code: ${String(error)}`);
      }
    }

    // Bottom info block
    const bottomY = y + height - pad - 52;
    const durationLabel = this.formatDuration(ticket.durationMinutes);
    const priceLabel = `${ticket.priceXof.toLocaleString("fr-FR")} FCFA`;

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#0f172a")
      .text(ticket.planName, x + pad, bottomY, {
        width: width - pad * 2,
        align: "center",
      });

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#475569")
      .text(`${durationLabel}  ·  ${priceLabel}`, x + pad, bottomY + 13, {
        width: width - pad * 2,
        align: "center",
      });

    // Expiry / creation date
    const dateLabel = ticket.createdAt
      ? `Émis le ${new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(ticket.createdAt)}`
      : "";
    if (dateLabel) {
      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor("#94a3b8")
        .text(dateLabel, x + pad, bottomY + 27, {
          width: width - pad * 2,
          align: "center",
        });
    }
  }

  private formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return hours === 1 ? "1 heure" : `${hours} heures`;
    }
    return `${hours}h${String(remainingMinutes).padStart(2, "0")}`;
  }

  private async loadSettings(
    businessName?: string,
  ): Promise<TicketPrintSettings> {
    const settings = await this.settingsService.getAll();
    const read = (key: string, fallback = "") =>
      settings[key]?.value ?? fallback;
    const readBool = (key: string, fallback: boolean) => {
      const value = read(key, fallback ? "true" : "false").toLowerCase();
      return value === "true";
    };

    const enterpriseName =
      businessName?.trim() || read("ticket.enterprise_name", "MikroServer");
    const wifiSsid = read("ticket.wifi_ssid", "");

    return {
      enterpriseName,
      showEnterpriseName: readBool("ticket.show_enterprise_name", true),
      showWifiName: readBool("ticket.show_wifi_name", true),
      wifiSsid,
      showPrice: readBool("ticket.show_price", true),
      currencySymbol: read("ticket.currency_symbol", "FCFA") || "FCFA",
      showTicketNumber: readBool("ticket.show_ticket_number", true),
      showQrCode: readBool("ticket.show_qr_code", false),
      showPlanName: readBool("ticket.show_plan_name", true),
      showCreatedAt: readBool("ticket.show_created_at", false),
      showDnsName: readBool("ticket.show_dns_name", false),
      dnsName: read("ticket.dns_name", ""),
      keepTicketNotice: readBool("ticket.keep_ticket_notice", true),
      showLogo: readBool("ticket.show_logo", false),
      logoUrl: read("ticket.logo_url", ""),
      ticketsPerPage: this.normalizeTicketsPerPage(
        parseInt(read("ticket.pdf_tickets_per_page", "50"), 10),
      ),
    };
  }

  private renderDetailedSheet(
    doc: PDFKit.PDFDocument,
    preparedTickets: PreparedTicket[],
    settings: TicketPrintSettings,
    logoBuffer: Buffer | null,
  ): void {
    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columnGap = 14;
    const columns = 2;
    const cardWidth = (pageWidth - columnGap) / columns;
    const cardHeight = 280;
    const rowGap = 14;
    const footerHeight = 22;

    let cursorY = doc.page.margins.top;
    let columnIndex = 0;

    preparedTickets.forEach(({ ticket, qrBuffer }, index) => {
      if (
        columnIndex === 0 &&
        cursorY + cardHeight + footerHeight >
          doc.page.height - doc.page.margins.bottom
      ) {
        doc.addPage();
        cursorY = doc.page.margins.top;
      }

      const x = doc.page.margins.left + columnIndex * (cardWidth + columnGap);
      this.drawTicketCard(doc, {
        x,
        y: cursorY,
        width: cardWidth,
        height: cardHeight,
        ticket,
        ticketIndex: index + 1,
        settings,
        logoBuffer,
        qrBuffer,
      });

      columnIndex += 1;
      if (columnIndex >= columns) {
        columnIndex = 0;
        cursorY += cardHeight + rowGap;
      }
    });
  }

  private renderCompactSheet(
    doc: PDFKit.PDFDocument,
    preparedTickets: PreparedTicket[],
    settings: TicketPrintSettings,
    ticketsPerPage: 10 | 25 | 50,
  ): void {
    const layout = this.getCompactLayout(ticketsPerPage);
    const usableWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const usableHeight =
      doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
    const cardWidth =
      (usableWidth - layout.columnGap * (layout.columns - 1)) / layout.columns;
    const cardHeight =
      (usableHeight - layout.rowGap * (layout.rows - 1)) / layout.rows;

    preparedTickets.forEach(({ ticket }, index) => {
      if (index > 0 && index % ticketsPerPage === 0) {
        doc.addPage();
      }

      const indexOnPage = index % ticketsPerPage;
      const column = indexOnPage % layout.columns;
      const row = Math.floor(indexOnPage / layout.columns);
      const x = doc.page.margins.left + column * (cardWidth + layout.columnGap);
      const y = doc.page.margins.top + row * (cardHeight + layout.rowGap);

      this.drawCompactTicketCard(doc, {
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        ticket,
        ticketIndex: index + 1,
        settings,
      });
    });
  }

  private async fetchRemoteImage(url: string): Promise<Buffer | null> {
    try {
      const response = await axios.get<ArrayBuffer>(url, {
        responseType: "arraybuffer",
        timeout: 5000,
      });
      return Buffer.from(response.data);
    } catch (error) {
      this.logger.warn(`Unable to load ticket logo: ${String(error)}`);
      return null;
    }
  }

  private async prepareTickets(
    tickets: VoucherTicket[],
    includeQrCode: boolean,
  ): Promise<PreparedTicket[]> {
    if (!includeQrCode) {
      return tickets.map((ticket) => ({ ticket, qrBuffer: null }));
    }

    return Promise.all(
      tickets.map(async (ticket) => ({
        ticket,
        qrBuffer: await this.createQrBuffer(ticket.code),
      })),
    );
  }

  private drawTicketCard(
    doc: PDFKit.PDFDocument,
    input: {
      x: number;
      y: number;
      width: number;
      height: number;
      ticket: VoucherTicket;
      ticketIndex: number;
      settings: TicketPrintSettings;
      logoBuffer: Buffer | null;
      qrBuffer: Buffer | null;
    },
  ): void {
    const {
      x,
      y,
      width,
      height,
      ticket,
      ticketIndex,
      settings,
      logoBuffer,
      qrBuffer,
    } = input;
    const pad = 14;
    const cardRight = x + width;
    const cardBottom = y + height;
    const sameCredential = ticket.code === ticket.password;
    const wifiName = settings.wifiSsid || ticket.routerName || "";

    doc.save();
    doc
      .roundedRect(x, y, width, height, 14)
      .fillAndStroke("#fffdf7", "#d7dce5");
    doc.restore();

    let cursorY = y + pad;

    if (settings.showTicketNumber) {
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#1f2937")
        .text(`#${ticketIndex}`, x + pad, cursorY, {
          width: 46,
        });
    }

    if (logoBuffer) {
      try {
        doc.image(logoBuffer, cardRight - pad - 34, cursorY - 2, {
          fit: [34, 34],
          align: "right",
        });
      } catch (error) {
        this.logger.warn(`Unable to render ticket logo: ${String(error)}`);
      }
    }

    cursorY += 18;

    if (settings.showEnterpriseName && settings.enterpriseName) {
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor("#0f172a")
        .text(settings.enterpriseName, x + pad, cursorY, {
          width: width - pad * 2 - (logoBuffer ? 42 : 0),
        });
      cursorY += 16;
    }

    if (settings.showPlanName) {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#6b7280")
        .text(ticket.planName, x + pad, cursorY, {
          width: width - pad * 2,
        });
      cursorY += 14;
    }

    const credentialBoxY = cursorY + 4;
    doc
      .roundedRect(
        x + pad,
        credentialBoxY,
        width - pad * 2,
        sameCredential ? 52 : 70,
        10,
      )
      .stroke("#0f172a");

    if (sameCredential) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#6b7280")
        .text("Code / password", x + pad + 12, credentialBoxY + 8);
      doc
        .font("Helvetica-Bold")
        .fontSize(20)
        .fillColor("#0f172a")
        .text(ticket.code, x + pad + 12, credentialBoxY + 20, {
          width: width - pad * 2 - 24,
          align: "center",
        });
    } else {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#6b7280")
        .text(`User: ${ticket.code}`, x + pad + 12, credentialBoxY + 10, {
          width: width - pad * 2 - 24,
        });
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#6b7280")
        .text(
          `Password: ${ticket.password}`,
          x + pad + 12,
          credentialBoxY + 34,
          {
            width: width - pad * 2 - 24,
          },
        );
    }

    cursorY = credentialBoxY + (sameCredential ? 64 : 82);

    if (settings.showPrice || settings.showCreatedAt) {
      const metaParts: string[] = [];
      if (settings.showPrice) {
        metaParts.push(
          `${ticket.priceXof.toLocaleString("fr-FR")} ${settings.currencySymbol}`.trim(),
        );
      }
      if (settings.showCreatedAt) {
        metaParts.push(this.formatDateTime(ticket.createdAt));
      }
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#111827")
        .text(metaParts.join("  |  "), x + pad, cursorY, {
          width: width - pad * 2,
        });
      cursorY += 16;
    }

    if (settings.showWifiName && wifiName) {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#111827")
        .text(`WiFi: ${wifiName}`, x + pad, cursorY, {
          width: width - pad * 2,
        });
      cursorY += 13;
    }

    if (settings.showDnsName && settings.dnsName) {
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#111827")
        .text(`DNS: ${settings.dnsName}`, x + pad, cursorY, {
          width: width - pad * 2,
        });
      cursorY += 13;
    }

    const instructions = [
      `1. Connect to the WiFi network${wifiName ? ` ${wifiName}` : ""}.`,
      sameCredential
        ? "2. Use this same ticket as username and password if needed."
        : "2. Use the user and password shown above on the hotspot page.",
    ];

    doc
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor("#4b5563")
      .text(instructions.join("\n"), x + pad, cursorY + 2, {
        width: settings.showQrCode ? width - pad * 2 - 82 : width - pad * 2,
        lineGap: 2,
      });

    if (settings.showQrCode && qrBuffer) {
      doc.image(qrBuffer, cardRight - pad - 70, cardBottom - pad - 70, {
        fit: [70, 70],
      });
    }

    if (settings.keepTicketNotice) {
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#b45309")
        .text(
          "Keep this ticket during the service.",
          x + pad,
          cardBottom - pad - 12,
          { width: width - pad * 2 - (settings.showQrCode ? 82 : 0) },
        );
    }
  }

  private drawCompactTicketCard(
    doc: PDFKit.PDFDocument,
    input: {
      x: number;
      y: number;
      width: number;
      height: number;
      ticket: VoucherTicket;
      ticketIndex: number;
      settings: TicketPrintSettings;
    },
  ): void {
    const { x, y, width, height, ticket, ticketIndex, settings } = input;
    const pad = 5;
    const sameCredential = ticket.code === ticket.password;
    const wifiName = settings.wifiSsid || ticket.routerName || "";
    const topMeta: string[] = [];

    if (settings.showTicketNumber) {
      topMeta.push(`#${ticketIndex}`);
    }
    if (settings.showPrice) {
      topMeta.push(
        `${ticket.priceXof.toLocaleString("fr-FR")} ${settings.currencySymbol}`.trim(),
      );
    }

    doc.save();
    doc.roundedRect(x, y, width, height, 6).fillAndStroke("#ffffff", "#cbd5e1");
    doc.restore();

    let cursorY = y + pad;

    if (topMeta.length > 0) {
      doc
        .font("Helvetica-Bold")
        .fontSize(6.5)
        .fillColor("#475569")
        .text(topMeta.join("  "), x + pad, cursorY, {
          width: width - pad * 2,
          align: "left",
        });
      cursorY += 9;
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(sameCredential ? (width < 110 ? 10.5 : 12) : 8.5)
      .fillColor("#0f172a");

    if (sameCredential) {
      doc.text(ticket.code, x + pad, cursorY, {
        width: width - pad * 2,
        align: "center",
      });
      cursorY += width < 110 ? 16 : 18;
    } else {
      doc.text(`U: ${ticket.code}`, x + pad, cursorY, {
        width: width - pad * 2,
        align: "center",
      });
      cursorY += 11;
      doc.text(`P: ${ticket.password}`, x + pad, cursorY, {
        width: width - pad * 2,
        align: "center",
      });
      cursorY += 11;
    }

    const footerLines: string[] = [];
    if (settings.showPlanName && ticket.planName) {
      footerLines.push(ticket.planName);
    }
    if (settings.showWifiName && wifiName) {
      footerLines.push(wifiName);
    }
    if (settings.showCreatedAt) {
      footerLines.push(this.formatDateTime(ticket.createdAt));
    }

    if (footerLines.length > 0) {
      doc
        .font("Helvetica")
        .fontSize(6.5)
        .fillColor("#475569")
        .text(
          footerLines.slice(0, 3).join("\n"),
          x + pad,
          height + y - pad - 20,
          {
            width: width - pad * 2,
            align: "center",
            lineGap: 1,
          },
        );
    }
  }

  private async createQrBuffer(content: string): Promise<Buffer | null> {
    try {
      return await QRCode.toBuffer(content, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 70,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      });
    } catch (error) {
      this.logger.warn(`Unable to render QR code: ${String(error)}`);
      return null;
    }
  }

  private formatDateTime(value: Date): string {
    return new Intl.DateTimeFormat("fr-FR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(value);
  }

  private normalizeTicketsPerPage(value: number): 10 | 25 | 50 {
    if (value >= 50) return 50;
    if (value >= 25) return 25;
    return 10;
  }

  private getCompactLayout(ticketsPerPage: 10 | 25 | 50): {
    columns: number;
    rows: number;
    columnGap: number;
    rowGap: number;
  } {
    switch (ticketsPerPage) {
      case 50:
        return { columns: 5, rows: 10, columnGap: 6, rowGap: 5 };
      case 25:
        return { columns: 5, rows: 5, columnGap: 8, rowGap: 8 };
      case 10:
      default:
        return { columns: 2, rows: 5, columnGap: 12, rowGap: 12 };
    }
  }
}
