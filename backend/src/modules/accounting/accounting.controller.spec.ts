import { AccountingController } from "./accounting.controller";

describe("AccountingController", () => {
  const accountingService = {
    findInvoices: jest.fn(),
    generateInvoice: jest.fn(),
    getRevenueByPeriod: jest.fn(),
  };

  const controller = new AccountingController(accountingService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("forwards invoice pagination query", () => {
    const user = { sub: "user-1", role: "ADMIN" } as any;
    controller.findInvoices(user, { page: 2, limit: 30 });
    expect(accountingService.findInvoices).toHaveBeenCalledWith(
      "user-1",
      2,
      30,
    );
  });

  it("maps monthly revenue query with default months", () => {
    const user = { sub: "user-1", role: "ADMIN" } as any;
    controller.getRevenueByPeriod(user, {});
    expect(accountingService.getRevenueByPeriod).toHaveBeenCalledWith(
      "user-1",
      "ADMIN",
      12,
    );
  });
});
