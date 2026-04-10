import { SetMetadata } from "@nestjs/common";
import { AppPermission } from "../permissions/permissions.constants";

export const PERMISSIONS_KEY = "permissions";
export const Permissions = (...permissions: AppPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
