import { MetricsController } from "../../metrics/metrics.controller";
import { PlansController } from "../../plans/plans.controller";
import { RoutersController } from "../../routers/routers.controller";
import { UsersController } from "../../users/users.controller";
import { VouchersController } from "../../vouchers/vouchers.controller";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import type { AppPermission } from "./permissions.constants";

type ControllerPermissionMap = Record<string, AppPermission>;

function expectControllerPermissions(
  controller: { prototype: object },
  expected: ControllerPermissionMap,
) {
  for (const [methodName, requiredPermission] of Object.entries(expected)) {
    const method = (controller.prototype as Record<string, unknown>)[
      methodName
    ];
    expect(typeof method).toBe("function");

    const permissions = Reflect.getMetadata(
      PERMISSIONS_KEY,
      method as object,
    ) as AppPermission[] | undefined;

    expect(permissions).toContain(requiredPermission);
  }
}

describe("controller permissions coverage", () => {
  it("protects users management endpoints with users.* permissions", () => {
    expectControllerPermissions(UsersController, {
      findAll: "users.view",
      permissionOptions: "users.manage",
      findResellers: "users.view",
      findOne: "users.view",
      create: "users.manage",
      updateProfile: "users.manage",
      updateAccess: "users.manage",
      resetPassword: "users.manage",
      suspend: "users.manage",
      activate: "users.manage",
      remove: "users.manage",
    });
  });

  it("protects vouchers endpoints with tickets.* permissions", () => {
    expectControllerPermissions(VouchersController, {
      findAll: "tickets.view",
      inventorySummary: "tickets.view",
      verify: "tickets.verify",
      deleteVerifiedTicket: "tickets.delete",
      bulkDelete: "tickets.delete",
      findOne: "tickets.view",
      revoke: "tickets.update",
      redeliver: "tickets.update",
      remove: "tickets.delete",
      generateBulk: "tickets.create",
      downloadPdf: "tickets.export",
    });
  });

  it("protects plans endpoints with plans.* permissions", () => {
    expectControllerPermissions(PlansController, {
      findAll: "plans.view",
      findOne: "plans.view",
      create: "plans.manage",
      update: "plans.manage",
      archive: "plans.manage",
    });
  });

  it("protects routers endpoints with routers.* permissions", () => {
    expectControllerPermissions(RoutersController, {
      findAll: "routers.view",
      findOne: "routers.view",
      create: "routers.manage",
      update: "routers.manage",
      remove: "routers.manage",
      healthCheck: "routers.health_check",
      sync: "routers.sync",
      bulkAction: "routers.manage",
      liveStats: "routers.live_stats",
      hotspotUserProfiles: "routers.view",
      createHotspotUserProfile: "routers.hotspot_manage",
      updateHotspotUserProfileConfig: "routers.hotspot_manage",
      removeHotspotUserProfile: "routers.hotspot_manage",
      hotspotIpBindings: "routers.view",
      createHotspotIpBinding: "routers.hotspot_manage",
      updateHotspotIpBinding: "routers.hotspot_manage",
      removeHotspotIpBinding: "routers.hotspot_manage",
      blockHotspotIpBinding: "routers.hotspot_manage",
      unblockHotspotIpBinding: "routers.hotspot_manage",
      enableHotspotIpBinding: "routers.hotspot_manage",
      disableHotspotIpBinding: "routers.hotspot_manage",
      hotspotUsers: "routers.view",
      updateHotspotUserProfile: "routers.hotspot_manage",
    });
  });

  it("protects metrics endpoints with reports.* permissions", () => {
    expectControllerPermissions(MetricsController, {
      getDashboard: "reports.view",
      getRevenueChart: "reports.view",
      getSubscriptionsStartedToday: "reports.view",
      getSubscriptionsExpiringToday: "reports.view",
      getTopRecurringClients: "reports.view",
      getTopRecurringPlans: "reports.view",
      getDailyRecommendations: "reports.view",
      getTicketReport: "reports.view",
      exportTicketReport: "reports.export",
      getIncidents: "reports.view",
    });
  });
});
