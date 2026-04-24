import { ProvisioningController } from "./provisioning.controller";

describe("ProvisioningController", () => {
  const provisioningService = {
    start: jest.fn(),
    prepare: jest.fn(),
    finalize: jest.fn(),
  };

  const controller = new ProvisioningController(provisioningService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts provisioning with validated payload", () => {
    const user = { sub: "operator-1" } as any;
    controller.start(user, {
      routerName: "R1",
      location: "Abidjan",
      apiUsername: "admin",
      apiPassword: "secret",
      publicIp: "1.2.3.4",
      apiPort: 8728,
    });

    expect(provisioningService.start).toHaveBeenCalledWith("operator-1", {
      routerName: "R1",
      location: "Abidjan",
      apiUsername: "admin",
      apiPassword: "secret",
      publicIp: "1.2.3.4",
      apiPort: 8728,
    });
  });

  it("finalizes provisioning by id", () => {
    const user = { sub: "operator-1" } as any;
    controller.finalize("f17ff8de-6fd2-4488-b3c9-d45864553f99", user, {
      routerIdentity: "MikroTik",
      hotspotName: "hotspot1",
    });

    expect(provisioningService.finalize).toHaveBeenCalledWith(
      "f17ff8de-6fd2-4488-b3c9-d45864553f99",
      "operator-1",
      "MikroTik",
      "hotspot1",
    );
  });
});
