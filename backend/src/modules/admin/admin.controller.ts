import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AdminService } from "./admin.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";
import {
  SetTenantStatusDto,
  SetUserStatusDto,
  UpdateTierDto,
} from "./dto/admin.dto";

@ApiTags("admin")
@Controller({ path: "admin", version: "1" })
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("metrics")
  @ApiOperation({ summary: "Métriques plateforme (MRR, tenants, routeurs)" })
  getMetrics() {
    return this.adminService.getMetrics();
  }

  @Get("tenants")
  @ApiOperation({ summary: "Lister les tenants (paginé, recherche par nom)" })
  listTenants(
    @Query("q") q?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.adminService.listTenants({
      q,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("tenants/:id")
  @ApiOperation({ summary: "Détail d'un tenant" })
  getTenant(@Param("id", ParseUUIDPipe) id: string) {
    return this.adminService.getTenant(id);
  }

  @Patch("tenants/:id/status")
  @ApiOperation({ summary: "Activer/suspendre un tenant" })
  setTenantStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SetTenantStatusDto,
  ) {
    return this.adminService.setTenantStatus(id, dto.status);
  }

  @Get("users")
  @ApiOperation({ summary: "Lister les utilisateurs (paginé)" })
  listUsers(
    @Query("q") q?: string,
    @Query("tenantId") tenantId?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.adminService.listUsers({
      q,
      tenantId,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch("users/:id/status")
  @ApiOperation({ summary: "Activer/suspendre un utilisateur" })
  setUserStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SetUserStatusDto,
  ) {
    return this.adminService.setUserStatus(id, dto.status);
  }

  @Get("invoices")
  @ApiOperation({ summary: "Lister les factures plateforme" })
  listInvoices(
    @Query("status") status?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.adminService.listInvoices({
      status,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("tiers")
  @ApiOperation({ summary: "Lister les tiers SaaS (y compris inactifs)" })
  listTiers() {
    return this.adminService.listTiers();
  }

  @Patch("tiers/:id")
  @ApiOperation({ summary: "Modifier un tier SaaS" })
  updateTier(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTierDto,
  ) {
    return this.adminService.updateTier(id, dto);
  }

  @Get("audit")
  @ApiOperation({ summary: "Journal d'audit plateforme" })
  listAudit(
    @Query("tenantId") tenantId?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.adminService.listAudit({
      tenantId,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
