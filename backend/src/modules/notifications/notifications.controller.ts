import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  Sse,
  MessageEvent,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { Observable } from "rxjs";
import { NotificationsService } from "./notifications.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../auth/interfaces/jwt-payload.interface";

@ApiTags("notifications")
@Controller({ path: "notifications", version: "1" })
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Sse("stream")
  @ApiOperation({ summary: "SSE stream for real-time notifications" })
  stream(@CurrentUser() user: JwtPayload): Observable<MessageEvent> {
    return this.notificationsService.getStream(
      user.sub,
    ) as Observable<MessageEvent>;
  }

  @Get()
  @ApiOperation({ summary: "List notifications" })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("unreadOnly") unreadOnly?: string,
  ) {
    return this.notificationsService.findAll(
      user.sub,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      unreadOnly === "true",
    );
  }

  @Get("unread-count")
  @ApiOperation({ summary: "Get unread notification count" })
  getUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.getUnreadCount(user.sub);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark notification as read" })
  markRead(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.markRead(id, user.sub);
  }

  @Patch("read-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Mark all notifications as read" })
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllRead(user.sub);
  }

  @Post("push/subscribe")
  @ApiOperation({ summary: "Register Web Push subscription" })
  subscribe(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      endpoint: string;
      p256dh: string;
      auth: string;
      userAgent?: string;
    },
  ) {
    return this.notificationsService.registerPushSubscription(
      user.sub,
      body.endpoint,
      body.p256dh,
      body.auth,
      body.userAgent,
    );
  }

  @Delete("push/subscribe")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove Web Push subscription" })
  unsubscribe(
    @CurrentUser() user: JwtPayload,
    @Body() body: { endpoint: string },
  ) {
    return this.notificationsService.removePushSubscription(
      user.sub,
      body.endpoint,
    );
  }
}
