import { UserRole, VoucherStatus } from "@prisma/client";
import {
  buildCodeSearchWhere,
  buildVoucherCodeCandidates,
  buildVoucherInventorySummary,
  canVoucherBeHardDeleted,
  ensureVoucherCanBeDeleted,
  getPublicStatusInfo,
  normalizeCodeLength,
  normalizeVoucherCode,
} from "./voucher.service.helpers";

describe("voucher.service.helpers", () => {
  it("builds normalized voucher code variants for search and verification", () => {
    const normalized = normalizeVoucherCode(" msab12cd34 ", "MS");
    const candidates = buildVoucherCodeCandidates("msab12cd34", "MS");

    expect(normalized).toBe("MS-AB12-CD34");
    expect(candidates).toContain("msab12cd34");
    expect(candidates).toContain("MSAB12CD34");
    expect(candidates).toContain("MS-AB12-CD34");
  });

  it("creates a case-insensitive search where clause from code candidates", () => {
    const where = buildCodeSearchWhere("ms-ab12", "MS");

    expect(where).toEqual({
      OR: expect.arrayContaining([
        {
          code: {
            contains: "MS-AB12",
            mode: "insensitive",
          },
        },
      ]),
    });
  });

  it("normalizes code length inside supported bounds", () => {
    expect(normalizeCodeLength(undefined, 12)).toBe(12);
    expect(normalizeCodeLength(2, 12)).toBe(4);
    expect(normalizeCodeLength(24, 12)).toBe(16);
    expect(normalizeCodeLength(9.8, 12)).toBe(9);
  });

  it("builds inventory summary buckets consistently", () => {
    const summary = buildVoucherInventorySummary([
      {
        planId: "plan-1",
        status: VoucherStatus.GENERATED,
        activatedAt: null,
        plan: {
          name: "Pack 1H",
          durationMinutes: 60,
          priceXof: 300,
        },
        router: {
          id: "router-1",
          name: "Plateau",
          status: "ONLINE",
        },
        createdBy: {
          id: "user-1",
          firstName: "Awa",
          lastName: "Traore",
          email: "awa@example.com",
        },
      },
      {
        planId: "plan-1",
        status: VoucherStatus.DELIVERY_FAILED,
        activatedAt: null,
        plan: {
          name: "Pack 1H",
          durationMinutes: 60,
          priceXof: 300,
        },
        router: null,
        createdBy: null,
      },
      {
        planId: "plan-2",
        status: VoucherStatus.ACTIVE,
        activatedAt: new Date("2026-03-24T08:00:00.000Z"),
        plan: {
          name: "Pack Jour",
          durationMinutes: 1440,
          priceXof: 2000,
        },
        router: {
          id: "router-2",
          name: "Cocody",
          status: "ONLINE",
        },
        createdBy: {
          id: "user-2",
          firstName: "Yao",
          lastName: "Kouame",
          email: "yao@example.com",
        },
      },
    ]);

    expect(summary.totals.total).toBe(3);
    expect(summary.totals.printable).toBe(1);
    expect(summary.totals.active).toBe(1);
    expect(summary.totals.issues).toBe(1);
    expect(summary.byPlan[0]).toMatchObject({
      planId: "plan-1",
      total: 2,
      printable: 1,
      issues: 1,
    });
  });

  it("protects used vouchers from hard delete while allowing safe ones", () => {
    expect(
      canVoucherBeHardDeleted({
        status: VoucherStatus.DELIVERED,
        activatedAt: null,
        createdById: "reseller-1",
        session: null,
      }),
    ).toBe(true);

    expect(
      canVoucherBeHardDeleted({
        status: VoucherStatus.ACTIVE,
        activatedAt: new Date(),
        createdById: "reseller-1",
        session: null,
      }),
    ).toBe(false);
  });

  it("rejects reseller deletion on foreign tickets", () => {
    expect(() =>
      ensureVoucherCanBeDeleted(
        {
          status: VoucherStatus.GENERATED,
          activatedAt: null,
          createdById: "reseller-2",
          session: null,
        },
        { sub: "reseller-1", role: UserRole.RESELLER },
      ),
    ).toThrow("vos propres tickets");
  });

  it("returns public status info suitable for operator checks", () => {
    expect(getPublicStatusInfo(VoucherStatus.DELIVERED)).toMatchObject({
      canLogin: true,
    });
    expect(getPublicStatusInfo(VoucherStatus.EXPIRED)).toMatchObject({
      canLogin: false,
    });
  });
});
