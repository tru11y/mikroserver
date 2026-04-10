import {
  buildCreateHotspotUserProfileCommands,
  buildUpdateHotspotUserProfileCommands,
  findCreatedHotspotUserProfile,
  mapAndSortHotspotUserProfiles,
} from "./router-hotspot-profiles.utils";
import type { HotspotUserProfileRecord } from "./router-api.types";

describe("router hotspot profiles utils", () => {
  it("maps and sorts hotspot profiles", () => {
    const rows: HotspotUserProfileRecord[] = [
      { ".id": "*2", name: "zeta" },
      { ".id": "*1", name: "alpha" },
      { ".id": "", name: "ignored" },
    ];

    const mapped = mapAndSortHotspotUserProfiles(rows);

    expect(mapped).toHaveLength(2);
    expect(mapped[0]?.name).toBe("alpha");
    expect(mapped[1]?.name).toBe("zeta");
  });

  it("builds create and update commands with trimmed values", () => {
    expect(
      buildCreateHotspotUserProfileCommands({
        name: " 7-Jours ",
        rateLimit: " 2M/4M ",
        sharedUsers: 1,
      }),
    ).toEqual([
      "/ip/hotspot/user/profile/add",
      "=name=7-Jours",
      "=rate-limit=2M/4M",
      "=shared-users=1",
    ]);

    expect(
      buildUpdateHotspotUserProfileCommands({
        profileId: "*1",
        sessionTimeout: " 7d 00:00:00 ",
      }),
    ).toEqual({
      commands: [
        "/ip/hotspot/user/profile/set",
        "=.id=*1",
        "=session-timeout=7d 00:00:00",
      ],
      hasUpdate: true,
    });
  });

  it("builds profile update commands only for changed fields and supports clearing rate-limit", () => {
    expect(
      buildUpdateHotspotUserProfileCommands(
        {
          profileId: "*9",
          name: " 7-Jours ",
          rateLimit: " 3M/4M ",
          sessionTimeout: " 7d 00:00:00 ",
        },
        {
          ".id": "*9",
          name: "7-Jours",
          "rate-limit": "2M/4M",
          "session-timeout": "7d 00:00:00",
        },
      ),
    ).toEqual({
      commands: [
        "/ip/hotspot/user/profile/set",
        "=.id=*9",
        "=rate-limit=3M/4M",
      ],
      hasUpdate: true,
    });

    expect(
      buildUpdateHotspotUserProfileCommands(
        {
          profileId: "*9",
          rateLimit: " ",
        },
        {
          ".id": "*9",
          name: "7-Jours",
          "rate-limit": "2M/4M",
        },
      ),
    ).toEqual({
      commands: ["/ip/hotspot/user/profile/set", "=.id=*9", "=rate-limit="],
      hasUpdate: true,
    });
  });

  it("finds a created profile from diff or matching name", () => {
    const refreshedRows: HotspotUserProfileRecord[] = [
      { ".id": "*1", name: "default" },
      { ".id": "*2", name: "7-Jours" },
    ];

    expect(
      findCreatedHotspotUserProfile(refreshedRows, new Set(["*1"]), "7-Jours"),
    ).toEqual(refreshedRows[1]);
  });
});
