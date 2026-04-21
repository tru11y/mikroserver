import { SessionsController } from "./sessions.controller";

describe("SessionsController", () => {
  const sessionsService = {
    findHistory: jest.fn(),
    terminate: jest.fn(),
  };

  const controller = new SessionsController(sessionsService as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps session history query", () => {
    const user = { sub: "operator-1", role: "ADMIN" } as any;
    controller.getHistory(user, {
      routerId: "f17ff8de-6fd2-4488-b3c9-d45864553f99",
      macAddress: "AA:BB:CC:DD:EE:FF",
      status: "ACTIVE" as any,
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-04-02T00:00:00.000Z",
      page: 2,
      limit: 10,
    });

    expect(sessionsService.findHistory).toHaveBeenCalledWith({
      routerId: "f17ff8de-6fd2-4488-b3c9-d45864553f99",
      macAddress: "AA:BB:CC:DD:EE:FF",
      status: "ACTIVE",
      from: new Date("2026-04-01T00:00:00.000Z"),
      to: new Date("2026-04-02T00:00:00.000Z"),
      page: 2,
      limit: 10,
      requestingUserId: "operator-1",
      requestingUserRole: "ADMIN",
    });
  });

  it("terminates session", () => {
    controller.terminate({
      routerId: "f17ff8de-6fd2-4488-b3c9-d45864553f99",
      mikrotikId: "*1A",
    });
    expect(sessionsService.terminate).toHaveBeenCalledWith(
      "f17ff8de-6fd2-4488-b3c9-d45864553f99",
      "*1A",
    );
  });
});
