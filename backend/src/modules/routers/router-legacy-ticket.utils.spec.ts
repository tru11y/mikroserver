import {
  findLegacyTicketOnRouter,
  normalizeLegacyCodeCandidates,
} from "./router-legacy-ticket.utils";

describe("router legacy ticket utils", () => {
  it("normalizes legacy code candidates", () => {
    expect(
      normalizeLegacyCodeCandidates(["  code-1 ", "", "code-1", "code-2"]),
    ).toEqual(["code-1", "code-2"]);
  });

  it("builds a legacy ticket match from active client and fallback hotspot user", async () => {
    const findUsers = jest.fn(async (username: string) => {
      if (username === "legacy-active") {
        return [];
      }

      if (username === "legacy-hotspot") {
        return [
          {
            name: "legacy-hotspot",
            password: "12345678",
            profile: "7-Jours",
            disabled: "false",
            "limit-uptime": "7d 00:00:00",
          },
        ];
      }

      return [];
    });

    const findActiveClients = jest.fn(async (username: string) => {
      if (username === "legacy-active") {
        return [
          {
            ".id": "*1",
            server: "hotspot1",
            user: "legacy-hotspot",
            address: "10.10.10.10",
            "mac-address": "AA:BB:CC:DD:EE:01",
            uptime: "01:00:00",
            "bytes-in": "1000",
            "bytes-out": "500",
            "packets-in": "5",
            "packets-out": "6",
          },
        ];
      }

      return [];
    });

    const result = await findLegacyTicketOnRouter({
      candidates: ["legacy-active"],
      passwordCandidates: ["12345678"],
      router: {
        id: "router-1",
        name: "Router A",
      },
      findUsers,
      findActiveClients,
    });

    expect(result).toEqual(
      expect.objectContaining({
        routerId: "router-1",
        routerName: "Router A",
        code: "legacy-hotspot",
        active: true,
        disabled: false,
        planName: "7-Jours",
        durationMinutes: 10080,
        passwordMatches: true,
      }),
    );
    expect(findUsers).toHaveBeenCalledWith("legacy-active");
    expect(findUsers).toHaveBeenCalledWith("legacy-hotspot");
  });
});
