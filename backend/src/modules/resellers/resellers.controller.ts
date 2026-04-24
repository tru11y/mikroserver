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
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { ResellersService } from "./resellers.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole, PayoutStatus } from "@prisma/client";
import {
  AddCreditDto,
  ApprovePayoutDto,
  CommissionTimeSeriesQueryDto,
  CreateResellerDto,
  GenerateResellerVouchersDto,
  ListAllPayoutsQueryDto,
  ListResellersQueryDto,
  RejectPayoutDto,
  RequestPayoutDto,
  UpdateResellerDto,
} from "./dto/resellers.dto";

@ApiTags("resellers")
@Controller({ path: "resellers", version: "1" })
@ApiBearerAuth()
export class ResellersController {
  constructor(private readonly resellersService: ResellersService) {}

  @Get("me")
  @Roles(UserRole.RESELLER)
  @ApiOperation({ summary: "Get own reseller stats" })
  getMyStats(@CurrentUser() user: JwtPayload) {
    return this.resellersService.getMyStats(user.sub);
  }

  @Post("me/generate-vouchers")
  @Roles(UserRole.RESELLER)
  @ApiOperation({ summary: "Generate vouchers using reseller credit" })
  generateVouchers(
    @CurrentUser() user: JwtPayload,
    @Body() body: GenerateResellerVouchersDto,
  ) {
    if (!body.planId) throw new BadRequestException("planId requis.");
    return this.resellersService.resellerGenerateVouchers(
      user.sub,
      body.planId,
      body.quantity ?? 1,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "List resellers" })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListResellersQueryDto,
  ) {
    return this.resellersService.findAll(user.sub, query.page, query.limit);
  }

  @Get("stats")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Reseller aggregate stats" })
  getStats(@CurrentUser() user: JwtPayload) {
    return this.resellersService.getStats(user.sub);
  }

  @Get(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Get reseller" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.resellersService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Create reseller config" })
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateResellerDto) {
    return this.resellersService.create(user.sub, body);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Update reseller config" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: UpdateResellerDto,
  ) {
    return this.resellersService.update(id, body);
  }

  @Post(":id/credit")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Add credit to reseller" })
  addCredit(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: AddCreditDto,
  ) {
    return this.resellersService.addCredit(id, body.amountXof);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Deactivate reseller" })
  deactivate(@Param("id", ParseUUIDPipe) id: string) {
    return this.resellersService.update(id, { isActive: false });
  }

  // --- Commission dashboard ---

  @Get("me/commissions")
  @Roles(UserRole.RESELLER)
  @ApiOperation({ summary: "Commission time-series for reseller" })
  getMyCommissions(
    @CurrentUser() user: JwtPayload,
    @Query() query: CommissionTimeSeriesQueryDto,
  ) {
    return this.resellersService.getCommissionTimeSeries(
      user.sub,
      query.period,
      query.days,
    );
  }

  @Post("me/payouts")
  @Roles(UserRole.RESELLER)
  @ApiOperation({ summary: "Request a commission payout" })
  requestPayout(
    @CurrentUser() user: JwtPayload,
    @Body() body: RequestPayoutDto,
  ) {
    if (!body.amountXof) throw new BadRequestException("amountXof requis.");
    return this.resellersService.requestPayout(user.sub, body.amountXof);
  }

  @Get("me/payouts")
  @Roles(UserRole.RESELLER)
  @ApiOperation({ summary: "List own payout history" })
  getMyPayouts(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListResellersQueryDto,
  ) {
    return this.resellersService.getPayoutHistory(
      user.sub,
      query.page,
      query.limit,
    );
  }

  @Get("payouts")
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "List all payout requests (super admin)" })
  listPayouts(@Query() query: ListAllPayoutsQueryDto) {
    return this.resellersService.listAllPayouts(
      query.status,
      query.page,
      query.limit,
    );
  }

  @Patch("payouts/:id/approve")
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Approve payout + record Wave reference" })
  approvePayout(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ApprovePayoutDto,
  ) {
    return this.resellersService.processPayout(
      id,
      "approve",
      body.waveReference,
      body.notes,
    );
  }

  @Patch("payouts/:id/reject")
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Reject payout (credits refunded)" })
  rejectPayout(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: RejectPayoutDto,
  ) {
    return this.resellersService.processPayout(
      id,
      "reject",
      undefined,
      body.notes,
    );
  }
}
