import { UserRole } from "@prisma/client";
import {
  APP_PERMISSIONS,
  PERMISSION_GROUP_LABELS,
  PERMISSION_PROFILES,
  getPermissionCatalog,
  normalizePermissionProfile,
  resolveUserPermissions,
  sanitizePermissions,
} from "./permissions.constants";

describe("permissions.constants", () => {
  it("sanitizes permissions to supported unique sorted values", () => {
    expect(
      sanitizePermissions([
        "tickets.view",
        "plans.view",
        "tickets.view",
        "invalid.permission",
        123,
      ]),
    ).toEqual(["plans.view", "tickets.view"]);
  });

  it("normalizes known permission profiles and rejects unknown ones", () => {
    expect(normalizePermissionProfile(" cashier ")).toBe("CASHIER");
    expect(normalizePermissionProfile("unknown")).toBeNull();
    expect(normalizePermissionProfile(null)).toBeNull();
  });

  it("grants all permissions to super admins", () => {
    expect(resolveUserPermissions(UserRole.SUPER_ADMIN, [], null)).toEqual([
      ...APP_PERMISSIONS,
    ]);
  });

  it("prefers explicit permissions over permission profiles", () => {
    expect(
      resolveUserPermissions(
        UserRole.RESELLER,
        ["tickets.verify", "invalid.permission", "tickets.verify"],
        "TECHNICIAN",
      ),
    ).toEqual(["tickets.verify", "tickets.view"]);
  });

  it("expands hierarchical permissions so manage scopes include view scopes", () => {
    expect(
      resolveUserPermissions(UserRole.ADMIN, ["users.manage"], null),
    ).toEqual(["users.manage", "users.view"]);
  });

  it("uses the selected permission profile when no explicit permissions are set", () => {
    expect(resolveUserPermissions(UserRole.VIEWER, [], " technician ")).toEqual(
      [
        ...new Set([
          ...PERMISSION_PROFILES.TECHNICIAN.permissions,
          "tickets.view",
          "routers.view",
          "routers.hotspot_manage",
        ]),
      ].sort(),
    );
  });

  it("keeps READ_ONLY profile strictly non-mutating on hotspot operations", () => {
    const viewerPermissions = resolveUserPermissions(
      UserRole.VIEWER,
      null,
      null,
    );
    expect(viewerPermissions).toContain("routers.view");
    expect(viewerPermissions).not.toContain("routers.hotspot_manage");
  });

  it("falls back to role defaults when no explicit permission source is provided", () => {
    expect(resolveUserPermissions(UserRole.ADMIN, null, null)).toEqual(
      [...PERMISSION_PROFILES.ADMIN_STANDARD.permissions].sort(),
    );
    expect(resolveUserPermissions(UserRole.RESELLER, null, null)).toEqual(
      [...PERMISSION_PROFILES.RESELLER_STANDARD.permissions].sort(),
    );
    expect(resolveUserPermissions(UserRole.VIEWER, null, null)).toEqual(
      [...PERMISSION_PROFILES.READ_ONLY.permissions].sort(),
    );
  });

  it("builds a permission catalog grouped by module and profile", () => {
    const catalog = getPermissionCatalog();

    expect(catalog.groups).toHaveLength(
      Object.keys(PERMISSION_GROUP_LABELS).length,
    );
    expect(catalog.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "tickets",
          label: PERMISSION_GROUP_LABELS.tickets,
          permissions: expect.arrayContaining([
            expect.objectContaining({
              key: "tickets.view",
            }),
          ]),
        }),
      ]),
    );
    expect(catalog.profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "CASHIER",
          permissions: [...PERMISSION_PROFILES.CASHIER.permissions],
        }),
      ]),
    );
  });
});
