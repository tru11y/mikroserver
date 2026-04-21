import { SpeedBoostsController } from "./speed-boosts.controller";

describe("SpeedBoostsController", () => {
  const speedBoostsService = {
    purchaseBoost: jest.fn(),
    listBoosts: jest.fn(),
  };

  const controller = new SpeedBoostsController(speedBoostsService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("purchases boost from public payload", () => {
    controller.purchase({
      voucherCode: "ABC123",
      tierId: "f17ff8de-6fd2-4488-b3c9-d45864553f99",
      customerPhone: "0700000000",
      customerName: "Alice",
    });

    expect(speedBoostsService.purchaseBoost).toHaveBeenCalledWith({
      voucherCode: "ABC123",
      tierId: "f17ff8de-6fd2-4488-b3c9-d45864553f99",
      customerPhone: "0700000000",
      customerName: "Alice",
    });
  });

  it("maps list query with tenancy scope", () => {
    const user = { sub: "admin-1", role: "ADMIN" } as any;
    controller.list(user, { sessionId: "s-1", page: 2, limit: 10 });

    expect(speedBoostsService.listBoosts).toHaveBeenCalledWith({
      sessionId: "s-1",
      status: undefined,
      page: 2,
      limit: 10,
      requestingUserRole: "ADMIN",
      requestingUserId: "admin-1",
    });
  });
});
