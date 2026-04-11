import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { AdminService } from "./admin.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { UserRole } from "@prisma/client";
import {
  AssignSubscriptionDto,
  CancelSubscriptionDto,
  ProvisionOperatorDto,
  RenewSubscriptionDto,
} from "./dto/admin.dto";

@ApiTags("admin")
@Controller({ path: "admin", version: "1" })
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ---------------------------------------------------------------------------
  // Operator listing & detail
  // ---------------------------------------------------------------------------

  @Get("operators")
  @ApiOperation({
    summary: "Lister tous les opérateurs avec tier SaaS et stats d'usage",
    description:
      "Retourne chaque utilisateur ADMIN avec son tier actuel, " +
      "le nombre de routeurs, de vouchers et le revenu mensuel/total. " +
      "Accès : SUPER_ADMIN uniquement.",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  listOperators(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    return this.adminService.listOperators(page, Math.min(limit, 100));
  }

  @Get("operators/:id")
  @ApiOperation({ summary: "Détail d'un opérateur avec stats complètes" })
  @ApiParam({ name: "id", description: "UUID de l'opérateur" })
  getOperator(@Param("id", ParseUUIDPipe) id: string) {
    return this.adminService.getOperator(id);
  }

  // ---------------------------------------------------------------------------
  // Operator provisioning
  // ---------------------------------------------------------------------------

  @Post("operators")
  @ApiOperation({
    summary: "Provisionner un nouvel opérateur (compte + abonnement optionnel)",
    description:
      "Crée un compte ADMIN actif et, si tierId est fourni, lui assigne immédiatement " +
      "un abonnement SaaS. Retourne le mot de passe temporaire en clair — " +
      "à transmettre à l'opérateur par canal sécurisé.",
  })
  provisionOperator(@Body() dto: ProvisionOperatorDto) {
    return this.adminService.provisionOperator(dto);
  }

  // ---------------------------------------------------------------------------
  // Subscription management
  // ---------------------------------------------------------------------------

  @Get("subscriptions")
  @ApiOperation({
    summary: "Lister tous les abonnements opérateurs",
    description:
      "Retourne tous les OperatorSubscription avec tier, dates et statut. " +
      "Utile pour avoir un tableau de bord de la facturation.",
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  listSubscriptions(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(25), ParseIntPipe) limit: number,
  ) {
    return this.adminService.listSubscriptions(page, Math.min(limit, 100));
  }

  @Get("operators/:id/subscription")
  @ApiOperation({ summary: "Voir l'abonnement d'un opérateur" })
  @ApiParam({ name: "id", description: "UUID de l'opérateur" })
  getOperatorSubscription(@Param("id", ParseUUIDPipe) id: string) {
    return this.adminService.getOperatorSubscription(id);
  }

  @Post("operators/:id/subscription")
  @ApiOperation({
    summary: "Assigner ou changer le tier SaaS d'un opérateur",
    description:
      "Crée ou remplace l'abonnement de l'opérateur (upsert). " +
      "Calcule automatiquement la date de fin selon le billing cycle. " +
      "Utilise POST /operators/:id/subscription/renew pour prolonger sans changer de tier.",
  })
  @ApiParam({ name: "id", description: "UUID de l'opérateur" })
  assignSubscription(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AssignSubscriptionDto,
  ) {
    return this.adminService.assignSubscription(id, dto);
  }

  @Post("operators/:id/subscription/renew")
  @ApiOperation({
    summary: "Renouveler l'abonnement d'un opérateur (prolonger la date de fin)",
    description:
      "Étend la date de fin de l'abonnement actuel. " +
      "Si months n'est pas fourni, applique 1 mois (mensuel) ou 12 mois (annuel).",
  })
  @ApiParam({ name: "id", description: "UUID de l'opérateur" })
  renewSubscription(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RenewSubscriptionDto,
  ) {
    return this.adminService.renewSubscription(id, dto);
  }

  @Delete("operators/:id/subscription")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Résilier l'abonnement d'un opérateur",
    description:
      "Passe le statut à CANCELLED. L'opérateur garde accès jusqu'à la date de fin " +
      "(grace period géré par SubscriptionActiveGuard).",
  })
  @ApiParam({ name: "id", description: "UUID de l'opérateur" })
  cancelSubscription(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return this.adminService.cancelSubscription(id, dto);
  }

  // ---------------------------------------------------------------------------
  // SaaS Tier management
  // ---------------------------------------------------------------------------

  @Get("tiers")
  @ApiOperation({
    summary: "Lister tous les tiers SaaS (y compris inactifs)",
    description:
      "Vue SUPER_ADMIN : retourne tous les tiers, actifs et inactifs. " +
      "Le endpoint public GET /saas/tiers ne retourne que les tiers actifs.",
  })
  listTiers() {
    return this.adminService.listAllTiers();
  }
}
