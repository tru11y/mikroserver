import {
  readHotspotIpBindingsSnapshot,
  readMappedHotspotUsers,
} from "./router-hotspot-readers.utils";

describe("router hotspot readers utils", () => {
  it("reads hotspot users sequentially and maps active sessions", async () => {
    const calls: Array<{ command: string; parameters: string[] }> = [];
    const runParsedCommand = jest.fn(
      async (
        command: string,
        parameters: string[] = [],
      ): Promise<unknown[]> => {
        calls.push({ command, parameters });

        if (command === "/ip/hotspot/user/print") {
          return [
            {
              ".id": "*1",
              name: "alice",
              profile: "default",
            },
          ];
        }

        if (command === "/ip/hotspot/active/print") {
          return [
            {
              ".id": "*active-1",
              user: "alice",
              address: "10.0.0.2",
              "mac-address": "AA:BB:CC:DD:EE:FF",
            },
          ];
        }

        return [];
      },
    ) as unknown as <T>(command: string, parameters?: string[]) => Promise<T[]>;

    const rows = await readMappedHotspotUsers({
      runParsedCommand,
      hotspotServer: "hotspot1",
    });

    expect(calls).toEqual([
      { command: "/ip/hotspot/user/print", parameters: [] },
      {
        command: "/ip/hotspot/active/print",
        parameters: ["?server=hotspot1"],
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      username: "alice",
      active: true,
      activeAddress: "10.0.0.2",
    });
  });

  it("reads hotspot ip-binding snapshot sequentially", async () => {
    const calls: Array<{ command: string; parameters: string[] }> = [];
    const runParsedCommand = jest.fn(
      async (
        command: string,
        parameters: string[] = [],
      ): Promise<unknown[]> => {
        calls.push({ command, parameters });

        if (command === "/ip/hotspot/ip-binding/print") {
          return [{ ".id": "*1", address: "10.0.0.9" }];
        }

        if (command === "/ip/hotspot/host/print") {
          return [{ address: "10.0.0.9", user: "alice" }];
        }

        if (command === "/ip/hotspot/active/print") {
          return [{ address: "10.0.0.9", user: "alice" }];
        }

        return [];
      },
    ) as unknown as <T>(command: string, parameters?: string[]) => Promise<T[]>;

    const snapshot = await readHotspotIpBindingsSnapshot({
      runParsedCommand,
      hotspotServer: "hotspot1",
    });

    expect(calls).toEqual([
      { command: "/ip/hotspot/ip-binding/print", parameters: [] },
      { command: "/ip/hotspot/host/print", parameters: [] },
      {
        command: "/ip/hotspot/active/print",
        parameters: ["?server=hotspot1"],
      },
    ]);
    expect(snapshot.ipBindings).toHaveLength(1);
    expect(snapshot.hosts).toHaveLength(1);
    expect(snapshot.active).toHaveLength(1);
  });
});
