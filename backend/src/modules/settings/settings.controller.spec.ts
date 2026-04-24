import { SettingsController } from "./settings.controller";

describe("SettingsController", () => {
  const settingsService = {
    getAll: jest.fn(),
    update: jest.fn(),
  };

  const controller = new SettingsController(settingsService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns all settings", () => {
    controller.getAll();
    expect(settingsService.getAll).toHaveBeenCalled();
  });

  it("updates settings with user id", () => {
    const user = { sub: "admin-1" } as any;
    controller.update({ appName: "MikroServer" }, user);
    expect(settingsService.update).toHaveBeenCalledWith(
      { appName: "MikroServer" },
      "admin-1",
    );
  });
});
