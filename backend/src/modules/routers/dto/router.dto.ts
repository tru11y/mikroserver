import {
  IsString,
  IsIP,
  IsInt,
  IsOptional,
  IsArray,
  IsIn,
  Min,
  Max,
  MinLength,
  MaxLength,
  ArrayMaxSize,
  ArrayUnique,
  IsUUID,
  IsBoolean,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { RouterStatus } from "@prisma/client";

export class CreateRouterDto {
  @ApiPropertyOptional({
    example: "Abidjan-Centre-01",
    description:
      "Display name — auto-generated from identity+address if omitted (direct mode)",
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: "Plateau, Abidjan" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional({ example: "Abidjan - Plateau" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  site?: string;

  @ApiPropertyOptional({ type: [String], example: ["centre-ville", "fibre"] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];

  @ApiPropertyOptional({
    example: "192.168.88.1",
    description: "RouterOS API host for WireGuard tunnel mode",
  })
  @IsOptional()
  @IsIP("4")
  wireguardIp?: string;

  @ApiPropertyOptional({ default: 8728 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  apiPort?: number;

  @ApiPropertyOptional({ example: "api-user" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  apiUsername?: string;

  @ApiPropertyOptional({
    description: "RouterOS API password (stored as plain for API use)",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  apiPassword?: string;

  @ApiPropertyOptional({ default: "default" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  hotspotProfile?: string;

  @ApiPropertyOptional({ default: "hotspot1" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  hotspotServer?: string;

  @ApiPropertyOptional({ description: "Owner user UUID (operator/admin)" })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  // ── Direct mode fields (mobile local-network provisioning) ──────────────────
  // Mobile app validates credentials directly against the router REST API,
  // then forwards router metadata here. Backend does NOT contact the router.

  @ApiPropertyOptional({
    example: "192.168.88.1",
    description: "LAN IP of the router (direct mode — stored in metadata)",
  })
  @IsOptional()
  @IsIP("4")
  address?: string;

  @ApiPropertyOptional({
    default: 80,
    description: "REST API port (direct mode)",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  port?: number;

  @ApiPropertyOptional({ description: "Username for direct LAN access" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  username?: string;

  @ApiPropertyOptional({
    description: "Password for direct LAN access (stored encrypted)",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  password?: string;

  @ApiPropertyOptional({
    example: "MikroTik",
    description: "Router identity from /rest/system/identity",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  identity?: string;

  @ApiPropertyOptional({
    example: "RB951Ui-2HnD",
    description: "Board name from /rest/system/resource",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  boardName?: string;

  @ApiPropertyOptional({
    example: "7.20.8",
    description: "RouterOS version from /rest/system/resource",
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  rosVersion?: string;

  @ApiPropertyOptional({ description: "User comment / label" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class UpdateRouterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional({
    example: "192.168.88.1",
    description: "RouterOS API host (IP address)",
  })
  @IsOptional()
  @IsIP("4")
  wireguardIp?: string;

  @ApiPropertyOptional({ example: 8728 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  apiPort?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  site?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  hotspotProfile?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  hotspotServer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  apiUsername?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  apiPassword?: string;

  @ApiPropertyOptional({ description: "Owner user UUID" })
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}

export class BulkRouterActionDto {
  @ApiProperty({ type: [String], example: ["uuid-router-1", "uuid-router-2"] })
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  routerIds!: string[];

  @ApiProperty({
    enum: ["HEALTH_CHECK", "SYNC", "ENABLE_MAINTENANCE", "DISABLE_MAINTENANCE"],
  })
  @IsString()
  @IsIn(["HEALTH_CHECK", "SYNC", "ENABLE_MAINTENANCE", "DISABLE_MAINTENANCE"])
  action!:
    | "HEALTH_CHECK"
    | "SYNC"
    | "ENABLE_MAINTENANCE"
    | "DISABLE_MAINTENANCE";
}

export class ListHotspotUsersQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class UpdateHotspotUserProfileDto {
  @ApiProperty({
    example: "*1A",
    description: "Identifiant .id RouterOS de /ip/hotspot/user",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  userId!: string;

  @ApiProperty({ example: "1H-3M" })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  profile!: string;

  @ApiPropertyOptional({
    default: false,
    description:
      "Si true et utilisateur actif, coupe les sessions en cours pour appliquer le nouveau profil immédiatement.",
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  disconnectActive?: boolean = false;
}

export class CreateHotspotUserProfileDto {
  @ApiProperty({ example: "1M-3M" })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: "3M/3M" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  rateLimit?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  sharedUsers?: number;

  @ApiPropertyOptional({ example: "1d 00:00:00" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionTimeout?: string;

  @ApiPropertyOptional({ example: "none" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  idleTimeout?: string;

  @ApiPropertyOptional({ example: "2m" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  keepaliveTimeout?: string;

  @ApiPropertyOptional({ example: "hs-pool" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  addressPool?: string;
}

export class UpdateHotspotUserProfileConfigDto {
  @ApiPropertyOptional({ example: "1M-3M" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: "3M/3M" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  rateLimit?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  sharedUsers?: number;

  @ApiPropertyOptional({ example: "1d 00:00:00" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionTimeout?: string;

  @ApiPropertyOptional({ example: "none" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  idleTimeout?: string;

  @ApiPropertyOptional({ example: "2m" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  keepaliveTimeout?: string;

  @ApiPropertyOptional({ example: "hs-pool" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  addressPool?: string;
}

export class CreateHotspotIpBindingDto {
  @ApiPropertyOptional({ example: "hotspot1" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  server?: string;

  @ApiPropertyOptional({ example: "10.0.0.120" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  address?: string;

  @ApiPropertyOptional({ example: "AA:BB:CC:DD:EE:FF" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  macAddress?: string;

  @ApiPropertyOptional({ enum: ["regular", "blocked", "bypassed"] })
  @IsOptional()
  @IsIn(["regular", "blocked", "bypassed"])
  type?: "regular" | "blocked" | "bypassed";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  comment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  toAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  addressList?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  disabled?: boolean;
}

export class UpdateHotspotIpBindingDto {
  @ApiPropertyOptional({ example: "hotspot1" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  server?: string;

  @ApiPropertyOptional({ example: "10.0.0.120" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  address?: string;

  @ApiPropertyOptional({ example: "AA:BB:CC:DD:EE:FF" })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  macAddress?: string;

  @ApiPropertyOptional({ enum: ["regular", "blocked", "bypassed"] })
  @IsOptional()
  @IsIn(["regular", "blocked", "bypassed"])
  type?: "regular" | "blocked" | "bypassed";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  comment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  toAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  addressList?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  disabled?: boolean;
}

export class ListRoutersQueryDto {
  @ApiPropertyOptional({ enum: RouterStatus })
  @IsOptional()
  @IsIn(Object.values(RouterStatus))
  status?: RouterStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  site?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  tag?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class DisconnectActiveByUsernameDto {
  @ApiProperty({ example: "ticket-ABC123" })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  username!: string;
}

export class MigrateRoutersDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dryRun?: boolean = false;
}
