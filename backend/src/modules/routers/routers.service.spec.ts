import { AuditAction, RouterStatus } from "@prisma/client";
import { RoutersService } from "./routers.service";

describe("RoutersService", () => {
  const createService = () => {
    const prisma = {
      router: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    const routerApiService = {
      checkRouterHealth: jest.fn(),
      syncRouterState: jest.fn(),
      getHotspotUserProfiles: jest.fn(),
      createHotspotUserProfile: jest.fn(),
      updateHotspotUserProfileConfig: jest.fn(),
      removeHotspotUserProfile: jest.fn(),
      getHotspotIpBindings: jest.fn(),
      createHotspotIpBinding: jest.fn(),
      updateHotspotIpBinding: jest.fn(),
      removeHotspotIpBinding: jest.fn(),
      setHotspotIpBindingBlocked: jest.fn(),
      setHotspotIpBindingDisabled: jest.fn(),
      getHotspotUsers: jest.fn(),
      updateHotspotUserProfile: jest.fn(),
    };
    const auditService = {
      log: jest.fn(),
    };

    const service = new RoutersService(
      prisma as never,
      routerApiService as never,
      auditService as never,
    );

    return { service, prisma, routerApiService, auditService };
  };

  it("exposes site and tags from router metadata", async () => {
    const { service, prisma } = createService();
    prisma.router.findMany.mockResolvedValue([
      {
        id: "router-1",
        name: "Plateau-01",
        description: "Centre ville",
        location: "Abidjan",
        wireguardIp: "10.66.66.2",
        apiPort: 8728,
        apiUsername: "api",
        apiPasswordHash: "secret",
        hotspotProfile: "default",
        hotspotServer: "hotspot1",
        status: RouterStatus.ONLINE,
        lastSeenAt: null,
        lastHeartbeatAt: null,
        site: "Plateau",
        tags: ["fibre", "premium"],
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ]);

    const result = await service.findAll();

    expect(result[0]?.site).toBe("Plateau");
    expect(result[0]?.tags).toEqual(["fibre", "premium"]);
    expect(result[0]).not.toHaveProperty("apiPasswordHash");
  });

  it("runs maintenance bulk action and audits the summary", async () => {
    const { service, prisma, auditService } = createService();
    prisma.router.findMany.mockResolvedValue([
      {
        id: "router-1",
        name: "Plateau-01",
        status: RouterStatus.ONLINE,
      },
      {
        id: "router-2",
        name: "Plateau-02",
        status: RouterStatus.ONLINE,
      },
    ]);
    prisma.router.update.mockResolvedValue({});

    const result = await service.bulkAction(
      {
        routerIds: ["router-1", "router-2"],
        action: "ENABLE_MAINTENANCE",
      },
      "admin-1",
    );

    expect(prisma.router.update).toHaveBeenCalledTimes(2);
    expect(result.processedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: AuditAction.UPDATE,
        entityType: "RouterBulkAction",
      }),
    );
  });

  it("reports missing routers in bulk actions without aborting the batch", async () => {
    const { service, prisma } = createService();
    prisma.router.findMany.mockResolvedValue([
      {
        id: "router-1",
        name: "Plateau-01",
        status: RouterStatus.ONLINE,
      },
    ]);
    prisma.router.update.mockResolvedValue({});

    const result = await service.bulkAction(
      {
        routerIds: ["router-1", "router-missing"],
        action: "ENABLE_MAINTENANCE",
      },
      "admin-1",
    );

    expect(prisma.router.update).toHaveBeenCalledTimes(1);
    expect(result.processedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.failed[0]).toEqual(
      expect.objectContaining({
        routerId: "router-missing",
        error: "Routeur introuvable ou deja supprime.",
      }),
    );
  });

  it("continues health checks when one router fails", async () => {
    const { service, prisma, routerApiService } = createService();
    prisma.router.findMany.mockResolvedValue([
      {
        id: "router-1",
        name: "Plateau-01",
        status: RouterStatus.ONLINE,
      },
      {
        id: "router-2",
        name: "Plateau-02",
        status: RouterStatus.ONLINE,
      },
    ]);
    routerApiService.checkRouterHealth
      .mockRejectedValueOnce(new Error("wireguard timeout"))
      .mockResolvedValueOnce({ online: true });

    const result = await service.bulkAction(
      {
        routerIds: ["router-1", "router-2"],
        action: "HEALTH_CHECK",
      },
      "admin-1",
    );

    expect(routerApiService.checkRouterHealth).toHaveBeenCalledTimes(2);
    expect(result.processedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.processed[0]).toEqual(
      expect.objectContaining({
        routerId: "router-2",
      }),
    );
    expect(result.failed[0]).toEqual(
      expect.objectContaining({
        routerId: "router-1",
        error: "wireguard timeout",
      }),
    );
  });

  it("updates network fields and metadata exposed by the router form", async () => {
    const { service, prisma } = createService();
    const existingRouter = {
      id: "router-1",
      name: "Plateau-01",
      description: "Centre ville",
      location: "Abidjan",
      wireguardIp: "10.66.66.2",
      apiPort: 8728,
      apiUsername: "api",
      hotspotProfile: "default",
      hotspotServer: "hotspot1",
      status: RouterStatus.ONLINE,
      lastSeenAt: null,
      lastHeartbeatAt: null,
      metadata: { site: "Plateau", tags: ["fibre"] },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      site: "Plateau",
      tags: ["fibre"],
    };
    const updatedRouter = {
      ...existingRouter,
      wireguardIp: "10.66.66.44",
      apiPort: 8729,
      metadata: { site: "Yopougon", tags: ["fibre", "backup"] },
      site: "Yopougon",
      tags: ["fibre", "backup"],
    };

    jest
      .spyOn(service, "findOne")
      .mockResolvedValueOnce(existingRouter as never)
      .mockResolvedValueOnce(updatedRouter as never);
    prisma.router.findFirst.mockResolvedValue(null);
    prisma.router.update.mockResolvedValue(updatedRouter);

    const result = await service.update(
      "router-1",
      {
        wireguardIp: "10.66.66.44",
        apiPort: 8729,
        site: "Yopougon",
        tags: ["fibre", "backup"],
      },
      "admin-1",
    );

    expect(prisma.router.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "router-1" },
        data: expect.objectContaining({
          wireguardIp: "10.66.66.44",
          apiPort: 8729,
          site: "Yopougon",
          tags: ["fibre", "backup"],
        }),
      }),
    );
    expect(result).toEqual(updatedRouter);
  });

  it("rejects router updates that reuse another active router ip", async () => {
    const { service, prisma } = createService();
    const existingRouter = {
      id: "router-1",
      name: "Plateau-01",
      description: "Centre ville",
      location: "Abidjan",
      wireguardIp: "10.66.66.2",
      apiPort: 8728,
      apiUsername: "api",
      hotspotProfile: "default",
      hotspotServer: "hotspot1",
      status: RouterStatus.ONLINE,
      lastSeenAt: null,
      lastHeartbeatAt: null,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      site: null,
      tags: [],
    };

    jest.spyOn(service, "findOne").mockResolvedValue(existingRouter as never);
    prisma.router.findFirst.mockResolvedValue({
      id: "router-2",
      name: "Plateau-02",
      wireguardIp: "10.66.66.99",
      deletedAt: null,
    });

    await expect(
      service.update("router-1", { wireguardIp: "10.66.66.99" }, "admin-1"),
    ).rejects.toThrow("Un serveur avec ce IP existe déjà.");
  });

  it("returns hotspot profiles from RouterOS for a router", async () => {
    const { service, routerApiService } = createService();
    const routerDetails = {
      id: "router-1",
      name: "Plateau-01",
      wireguardIp: "10.66.66.2",
      apiPort: 8728,
      apiUsername: "api",
      hotspotProfile: "default",
      hotspotServer: "hotspot1",
      status: RouterStatus.ONLINE,
      site: "Plateau",
      tags: ["fibre"],
    };
    jest.spyOn(service, "findOne").mockResolvedValue(routerDetails as never);
    routerApiService.getHotspotUserProfiles.mockResolvedValue([
      {
        id: "*1",
        name: "7-Jours",
        rateLimit: "2M/4M",
        sharedUsers: 1,
        sessionTimeout: "7d 00:00:00",
        idleTimeout: "none",
        keepaliveTimeout: "2m",
        addressPool: null,
      },
    ]);

    const result = await service.getHotspotUserProfiles("router-1");

    expect(result).toEqual([
      expect.objectContaining({ id: "*1", name: "7-Jours" }),
    ]);
    expect(routerApiService.getHotspotUserProfiles).toHaveBeenCalledWith(
      "router-1",
    );
  });

  it("updates hotspot user profile and records audit metadata", async () => {
    const { service, routerApiService, auditService } = createService();
    const routerDetails = {
      id: "router-1",
      name: "Plateau-01",
      wireguardIp: "10.66.66.2",
      apiPort: 8728,
      apiUsername: "api",
      hotspotProfile: "default",
      hotspotServer: "hotspot1",
      status: RouterStatus.ONLINE,
      site: "Plateau",
      tags: ["fibre"],
    };
    jest.spyOn(service, "findOne").mockResolvedValue(routerDetails as never);
    routerApiService.updateHotspotUserProfile.mockResolvedValue({
      userId: "*4A",
      username: "client-001",
      profile: "7-Jours",
      disconnectedSessions: 2,
    });

    const result = await service.updateHotspotUserProfile(
      "router-1",
      {
        userId: "*4A",
        profile: "7-Jours",
        disconnectActive: true,
      },
      "admin-1",
    );

    expect(result).toEqual(
      expect.objectContaining({
        userId: "*4A",
        disconnectedSessions: 2,
      }),
    );
    expect(routerApiService.updateHotspotUserProfile).toHaveBeenCalledWith(
      "router-1",
      expect.objectContaining({
        userId: "*4A",
        profile: "7-Jours",
        disconnectActive: true,
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: AuditAction.UPDATE,
        entityType: "RouterHotspotUser",
        entityId: "router-1:*4A",
        newValues: expect.objectContaining({
          disconnectedSessions: 2,
        }),
      }),
    );
  });

  it("blocks and enables ip bindings while keeping audit trace", async () => {
    const { service, routerApiService, auditService } = createService();
    const routerDetails = {
      id: "router-1",
      name: "Plateau-01",
      wireguardIp: "10.66.66.2",
      apiPort: 8728,
      apiUsername: "api",
      hotspotProfile: "default",
      hotspotServer: "hotspot1",
      status: RouterStatus.ONLINE,
      site: "Plateau",
      tags: ["fibre"],
    };
    jest.spyOn(service, "findOne").mockResolvedValue(routerDetails as never);
    routerApiService.setHotspotIpBindingBlocked.mockResolvedValue({
      id: "*7",
      address: "10.10.10.58",
      macAddress: "12:C5:C9:88:22:0C",
      server: "hotspot1",
      type: "blocked",
      comment: null,
      disabled: false,
      toAddress: null,
      addressList: null,
      resolvedUser: "7h7271128",
      hostName: null,
    });
    routerApiService.setHotspotIpBindingDisabled.mockResolvedValue({
      id: "*7",
      address: "10.10.10.58",
      macAddress: "12:C5:C9:88:22:0C",
      server: "hotspot1",
      type: "blocked",
      comment: null,
      disabled: false,
      toAddress: null,
      addressList: null,
      resolvedUser: "7h7271128",
      hostName: null,
    });

    const blocked = await service.blockHotspotIpBinding(
      "router-1",
      "*7",
      "admin-1",
    );
    const enabled = await service.enableHotspotIpBinding(
      "router-1",
      "*7",
      "admin-1",
    );

    expect(blocked.type).toBe("blocked");
    expect(enabled.disabled).toBe(false);
    expect(routerApiService.setHotspotIpBindingBlocked).toHaveBeenCalledWith(
      "router-1",
      "*7",
      true,
    );
    expect(routerApiService.setHotspotIpBindingDisabled).toHaveBeenCalledWith(
      "router-1",
      "*7",
      false,
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: AuditAction.UPDATE,
        entityType: "RouterHotspotIpBinding",
        entityId: "router-1:*7",
      }),
    );
  });
});
