import { PdfService } from "./pdf.service";

describe("PdfService", () => {
  const baseSettings = {
    "ticket.enterprise_name": {
      value: "MikroServer",
      description: "",
      isSecret: false,
    },
    "ticket.show_enterprise_name": {
      value: "true",
      description: "",
      isSecret: false,
    },
    "ticket.show_wifi_name": {
      value: "true",
      description: "",
      isSecret: false,
    },
    "ticket.wifi_ssid": {
      value: "OPEN WIFI 0704225955",
      description: "",
      isSecret: false,
    },
    "ticket.show_price": { value: "true", description: "", isSecret: false },
    "ticket.currency_symbol": {
      value: "FCFA",
      description: "",
      isSecret: false,
    },
    "ticket.show_ticket_number": {
      value: "true",
      description: "",
      isSecret: false,
    },
    "ticket.show_qr_code": { value: "false", description: "", isSecret: false },
    "ticket.pdf_tickets_per_page": {
      value: "50",
      description: "",
      isSecret: false,
    },
    "ticket.show_plan_name": {
      value: "true",
      description: "",
      isSecret: false,
    },
    "ticket.show_created_at": {
      value: "false",
      description: "",
      isSecret: false,
    },
    "ticket.show_dns_name": {
      value: "false",
      description: "",
      isSecret: false,
    },
    "ticket.dns_name": { value: "", description: "", isSecret: false },
    "ticket.keep_ticket_notice": {
      value: "true",
      description: "",
      isSecret: false,
    },
    "ticket.show_logo": { value: "false", description: "", isSecret: false },
    "ticket.logo_url": { value: "", description: "", isSecret: false },
  };

  const makeTickets = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      code: `7d8848${String(index).padStart(3, "0")}`,
      password: `7d8848${String(index).padStart(3, "0")}`,
      planName: "1-week",
      durationMinutes: 7 * 24 * 60,
      priceXof: 1000,
      routerName: "OPEN WIFI 0704225955",
      createdAt: new Date("2026-03-14T10:00:00.000Z"),
    }));

  it("renders 50 tickets on a single compact page when QR is disabled", async () => {
    const settingsService = {
      getAll: jest.fn().mockResolvedValue(baseSettings),
    };
    const service = new PdfService(settingsService as never);

    const pdf = await service.generateVoucherSheet(
      makeTickets(50),
      "OPEN WIFI",
      {
        includeQrCode: false,
        ticketsPerPage: 50,
      },
    );

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const pageMatches = pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? [];
    expect(pageMatches).toHaveLength(1);
  });

  it("creates a second page when compact output exceeds 50 tickets", async () => {
    const settingsService = {
      getAll: jest.fn().mockResolvedValue(baseSettings),
    };
    const service = new PdfService(settingsService as never);

    const pdf = await service.generateVoucherSheet(
      makeTickets(51),
      "OPEN WIFI",
      {
        includeQrCode: false,
        ticketsPerPage: 50,
      },
    );

    const pageMatches = pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? [];
    expect(pageMatches).toHaveLength(2);
  });

  it("allows overriding a QR-enabled default to force compact output", async () => {
    const settingsService = {
      getAll: jest.fn().mockResolvedValue({
        ...baseSettings,
        "ticket.show_qr_code": {
          value: "true",
          description: "",
          isSecret: false,
        },
      }),
    };
    const service = new PdfService(settingsService as never);

    const pdf = await service.generateVoucherSheet(
      makeTickets(50),
      "OPEN WIFI",
      {
        includeQrCode: false,
        ticketsPerPage: 50,
      },
    );

    const pageMatches = pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? [];
    expect(pageMatches).toHaveLength(1);
  });

  it("still renders a valid PDF when QR mode is enabled", async () => {
    const settingsService = {
      getAll: jest.fn().mockResolvedValue({
        ...baseSettings,
        "ticket.show_qr_code": {
          value: "true",
          description: "",
          isSecret: false,
        },
      }),
    };
    const service = new PdfService(settingsService as never);

    const pdf = await service.generateVoucherSheet(
      makeTickets(4),
      "OPEN WIFI",
      {
        includeQrCode: true,
        ticketsPerPage: 10,
      },
    );

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const pageMatches = pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? [];
    expect(pageMatches.length).toBeGreaterThanOrEqual(1);
  });
});
