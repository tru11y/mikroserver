import { Controller } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

/**
 * Webhooks Controller
 *
 * No payment provider is wired up yet (MOCK only, no external webhooks).
 * Add a handler here when a real payment aggregator is integrated.
 */
@ApiTags("webhooks")
@Controller({ path: "webhooks", version: "1" })
export class WebhooksController {}
