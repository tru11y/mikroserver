import { ResellersController } from "./resellers.controller";

describe("ResellersController", () => {
  const resellersService = {
    resellerGenerateVouchers: jest.fn(),
    findAll: jest.fn(),
    requestPayout: jest.fn(),
  };

  const controller = new ResellersController(resellersService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generates vouchers with reseller context", () => {
    const user = { sub: "reseller-1" } as any;
    controller.generateVouchers(user, { planId: "plan-1", quantity: 5 });

    expect(resellersService.resellerGenerateVouchers).toHaveBeenCalledWith(
      "reseller-1",
      "plan-1",
      5,
    );
  });

  it("requests payout with validated amount", () => {
    const user = { sub: "reseller-1" } as any;
    controller.requestPayout(user, { amountXof: 12000 });

    expect(resellersService.requestPayout).toHaveBeenCalledWith(
      "reseller-1",
      12000,
    );
  });
});
