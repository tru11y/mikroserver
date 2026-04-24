import { CustomersController } from "./customers.controller";

describe("CustomersController", () => {
  const customersService = {
    findAll: jest.fn(),
    block: jest.fn(),
  };

  const controller = new CustomersController(customersService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("forwards list filters and tenancy context", () => {
    const user = { sub: "operator-1", role: "ADMIN" } as any;
    controller.findAll(user, {
      routerId: "6d8f8da2-cc8b-4faf-9eb7-b2b95b41aeef",
      page: 3,
      limit: 10,
      search: "john",
    });

    expect(customersService.findAll).toHaveBeenCalledWith(
      "6d8f8da2-cc8b-4faf-9eb7-b2b95b41aeef",
      3,
      10,
      "john",
      "operator-1",
      "ADMIN",
    );
  });

  it("delegates block/unblock action", () => {
    controller.block("f17ff8de-6fd2-4488-b3c9-d45864553f99", {
      isBlocked: true,
    });
    expect(customersService.block).toHaveBeenCalledWith(
      "f17ff8de-6fd2-4488-b3c9-d45864553f99",
      true,
    );
  });
});
