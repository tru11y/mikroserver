import { NotificationsController } from "./notifications.controller";

describe("NotificationsController", () => {
  const notificationsService = {
    findAll: jest.fn(),
    registerPushSubscription: jest.fn(),
    removePushSubscription: jest.fn(),
  };

  const controller = new NotificationsController(notificationsService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("forwards pagination and unread filter", () => {
    const user = { sub: "user-1" } as any;
    controller.findAll(user, { page: 4, limit: 50, unreadOnly: true });
    expect(notificationsService.findAll).toHaveBeenCalledWith(
      "user-1",
      4,
      50,
      true,
    );
  });

  it("registers push subscription", () => {
    const user = { sub: "user-1" } as any;
    controller.subscribe(user, {
      endpoint: "https://push.endpoint",
      p256dh: "p256dh-key",
      auth: "auth-key",
      userAgent: "jest",
    });

    expect(notificationsService.registerPushSubscription).toHaveBeenCalledWith(
      "user-1",
      "https://push.endpoint",
      "p256dh-key",
      "auth-key",
      "jest",
    );
  });
});
