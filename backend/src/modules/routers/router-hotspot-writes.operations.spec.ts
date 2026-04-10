import {
  disconnectRouterHotspotActiveSession,
  disconnectRouterHotspotActiveSessionsByUsername,
  removeRouterHotspotUser,
} from "./router-hotspot-writes.operations";

describe("router hotspot writes operations", () => {
  const router = {
    wireguardIp: "10.66.66.2",
    apiPort: 8728,
    apiUsername: "api",
    apiPasswordHash: "secret",
    hotspotServer: "hotspot1",
  };

  it("removes all hotspot users matching a username", async () => {
    const executeOnRouter = jest.fn(async (_router, operation) => {
      const connection = {
        openChannel: () => ({
          write: jest.fn(),
          on: jest.fn(),
          once: jest
            .fn()
            .mockImplementationOnce((event, handler) => {
              if (event === "done") {
                handler({});
              }
            })
            .mockImplementationOnce((event, handler) => {
              if (event === "done") {
                handler(undefined);
              }
            })
            .mockImplementationOnce((event, handler) => {
              if (event === "done") {
                handler(undefined);
              }
            }),
        }),
      };
      await operation(connection as never);
    });
    const parseItems = jest
      .fn()
      .mockReturnValueOnce([{ ".id": "*1" }, { ".id": "*2" }]);
    const logger = { log: jest.fn() };

    await removeRouterHotspotUser(router, "ticket-001", {
      parseItems,
      executeOnRouter,
      executeOnRouterResult: jest.fn(),
      logger,
    });

    expect(executeOnRouter).toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalled();
  });

  it("returns the number of disconnected active sessions", async () => {
    const executeOnRouterResult = jest.fn(async (_router, operation) => {
      const connection = {
        openChannel: () => ({
          write: jest.fn(),
          on: jest.fn(),
          once: jest
            .fn()
            .mockImplementationOnce((event, handler) => {
              if (event === "done") {
                handler({});
              }
            })
            .mockImplementationOnce((event, handler) => {
              if (event === "done") {
                handler(undefined);
              }
            })
            .mockImplementationOnce((event, handler) => {
              if (event === "done") {
                handler(undefined);
              }
            }),
        }),
      };
      return operation(connection as never);
    });
    const parseItems = jest
      .fn()
      .mockReturnValue([{ ".id": "*1" }, { ".id": "*2" }]);
    const logger = { log: jest.fn() };

    const removedCount = await disconnectRouterHotspotActiveSessionsByUsername(
      router,
      "ticket-001",
      {
        parseItems,
        executeOnRouter: jest.fn(),
        executeOnRouterResult,
        logger,
      },
    );

    expect(removedCount).toBe(2);
    expect(logger.log).toHaveBeenCalled();
  });

  it("disconnects a single active session by id", async () => {
    const executeOnRouter = jest.fn(async (_router, operation) => {
      const connection = {
        openChannel: () => ({
          write: jest.fn(),
          on: jest.fn(),
          once: jest.fn((event, handler) => {
            if (event === "done") {
              handler(undefined);
            }
          }),
        }),
      };
      await operation(connection as never);
    });
    const logger = { log: jest.fn() };

    await disconnectRouterHotspotActiveSession(router, "*9", {
      parseItems: jest.fn(),
      executeOnRouter,
      executeOnRouterResult: jest.fn(),
      logger,
    });

    expect(executeOnRouter).toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalled();
  });
});
