import {
  buildCreateHotspotIpBindingCommands,
  buildUpdateHotspotIpBindingCommands,
  findCreatedHotspotIpBinding,
  resolveHotspotIpBindings,
} from "./router-hotspot-ip-bindings.utils";
import type {
  HotspotActiveClient,
  HotspotHostRecord,
  HotspotIpBindingRecord,
} from "./router-api.types";

describe("router hotspot ip bindings utils", () => {
  it("resolves user and host names from active sessions and hosts", () => {
    const snapshot = {
      ipBindings: [
        { ".id": "*1", address: "10.0.0.5", disabled: "false" },
        { ".id": "*2", "mac-address": "AA:BB:CC:DD:EE:FF", disabled: "yes" },
      ] as HotspotIpBindingRecord[],
      hosts: [
        {
          address: "10.0.0.5",
          user: "alice",
          "host-name": "alice-phone",
          server: "hotspot1",
        },
      ] as HotspotHostRecord[],
      active: [
        {
          address: "10.0.0.5",
          user: "alice",
          "mac-address": "11:22:33:44:55:66",
        },
      ] as HotspotActiveClient[],
    };

    const rows = resolveHotspotIpBindings(snapshot, "hotspot1");

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "*1",
      resolvedUser: "alice",
      hostName: "alice-phone",
      disabled: false,
    });
    expect(rows[1]?.disabled).toBe(true);
  });

  it("builds create/update commands and detects created rows", () => {
    expect(
      buildCreateHotspotIpBindingCommands({
        address: " 10.0.0.9 ",
        macAddress: " AA:BB ",
        type: "blocked",
        disabled: true,
      }),
    ).toEqual([
      "/ip/hotspot/ip-binding/add",
      "=address=10.0.0.9",
      "=mac-address=AA:BB",
      "=type=blocked",
      "=disabled=yes",
    ]);

    expect(
      buildUpdateHotspotIpBindingCommands({
        bindingId: "*1",
        server: " hotspot1 ",
        address: " 10.0.0.9 ",
        macAddress: " AA:BB ",
        comment: null,
        disabled: false,
      }),
    ).toEqual([
      "/ip/hotspot/ip-binding/set",
      "=.id=*1",
      "=server=hotspot1",
      "=address=10.0.0.9",
      "=mac-address=AA:BB",
      "=disabled=no",
    ]);

    expect(
      buildUpdateHotspotIpBindingCommands(
        {
          bindingId: "*9",
          server: " all ",
          address: " ",
          macAddress: " C8:47:8C:50:99:20 ",
          type: "bypassed",
          comment: "camera-aldji-11.02.26",
          toAddress: " ",
          addressList: " ",
          disabled: true,
        },
        {
          ".id": "*9",
          server: "all",
          "mac-address": "C8:47:8C:50:99:20",
          type: "blocked",
          comment: "camera-aldji-11.02.26",
          disabled: "yes",
        },
      ),
    ).toEqual(["/ip/hotspot/ip-binding/set", "=.id=*9", "=type=bypassed"]);

    const refreshedRows: HotspotIpBindingRecord[] = [
      { ".id": "*1", address: "10.0.0.5" },
      { ".id": "*2", address: "10.0.0.9", "mac-address": "AA:BB" },
    ];

    expect(
      findCreatedHotspotIpBinding(refreshedRows, new Set(["*1"]), {
        address: "10.0.0.9",
        macAddress: "AA:BB",
      }),
    ).toEqual(refreshedRows[1]);
  });
});
