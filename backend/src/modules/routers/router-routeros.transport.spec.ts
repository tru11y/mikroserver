import {
  executeRouterOperation,
  executeRouterOperationResult,
} from "./router-routeros.transport";
import type { MikroTikConnection, MikroTikModule } from "./router-api.types";

describe("router routeros transport", () => {
  const createMikroNode = (connection: MikroTikConnection): MikroTikModule => ({
    getConnection: jest.fn(() => connection),
    parseItems: jest.fn(),
  });

  it("closes the connection after a successful result operation", async () => {
    const connection: MikroTikConnection = {
      close: jest.fn(),
      openChannel: jest.fn(),
      getConnectPromise: jest.fn(async () => connection),
    };

    const result = await executeRouterOperationResult({
      mikroNode: createMikroNode(connection),
      wireguardIp: "10.66.66.2",
      apiPort: 8728,
      username: "api",
      password: "secret",
      timeoutMs: 10000,
      operation: async () => "ok",
    });

    expect(result).toBe("ok");
    expect(connection.close).toHaveBeenCalled();
  });

  it("closes the connection even when the operation throws", async () => {
    const connection: MikroTikConnection = {
      close: jest.fn(),
      openChannel: jest.fn(),
      getConnectPromise: jest.fn(async () => connection),
    };

    await expect(
      executeRouterOperation({
        mikroNode: createMikroNode(connection),
        wireguardIp: "10.66.66.2",
        apiPort: 8728,
        username: "api",
        password: "secret",
        timeoutMs: 10000,
        operation: async () => {
          throw new Error("boom");
        },
      }),
    ).rejects.toThrow("boom");

    expect(connection.close).toHaveBeenCalled();
  });
});
