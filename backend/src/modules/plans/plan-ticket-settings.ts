export const PLAN_TICKET_TYPES = ["PIN", "USER_PASSWORD"] as const;
export const PLAN_DURATION_MODES = ["ELAPSED", "PAUSED"] as const;

export type PlanTicketType = (typeof PLAN_TICKET_TYPES)[number];
export type PlanDurationMode = (typeof PLAN_DURATION_MODES)[number];

export interface PlanTicketSettings {
  ticketType: PlanTicketType;
  durationMode: PlanDurationMode;
  usersPerTicket: number;
  ticketPrefix: string;
  ticketCodeLength: number;
  ticketNumericOnly: boolean;
  ticketPasswordLength: number;
  ticketPasswordNumericOnly: boolean;
}

export type PlanTicketSettingsInput =
  | Partial<PlanTicketSettings>
  | null
  | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function sanitizePrefix(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.replace(/[^A-Za-z0-9]/g, "").slice(0, 12);
}

export function buildDefaultPlanTicketSettings(
  defaultPrefix: string,
  defaultCodeLength: number,
): PlanTicketSettings {
  return {
    ticketType: "PIN",
    durationMode: "ELAPSED",
    usersPerTicket: 1,
    ticketPrefix: sanitizePrefix(defaultPrefix, ""),
    ticketCodeLength: clampInteger(defaultCodeLength, 12, 4, 16),
    ticketNumericOnly: false,
    ticketPasswordLength: clampInteger(defaultCodeLength, 12, 4, 16),
    ticketPasswordNumericOnly: false,
  };
}

export function normalizePlanTicketSettings(
  input: PlanTicketSettingsInput,
  defaults: PlanTicketSettings,
): PlanTicketSettings {
  const source = isRecord(input) ? input : {};
  const ticketType = PLAN_TICKET_TYPES.includes(
    source["ticketType"] as PlanTicketType,
  )
    ? (source["ticketType"] as PlanTicketType)
    : defaults.ticketType;
  const durationMode = PLAN_DURATION_MODES.includes(
    source["durationMode"] as PlanDurationMode,
  )
    ? (source["durationMode"] as PlanDurationMode)
    : defaults.durationMode;

  return {
    ticketType,
    durationMode,
    usersPerTicket: clampInteger(
      source["usersPerTicket"],
      defaults.usersPerTicket,
      1,
      10,
    ),
    ticketPrefix: sanitizePrefix(source["ticketPrefix"], defaults.ticketPrefix),
    ticketCodeLength: clampInteger(
      source["ticketCodeLength"],
      defaults.ticketCodeLength,
      4,
      16,
    ),
    ticketNumericOnly:
      typeof source["ticketNumericOnly"] === "boolean"
        ? source["ticketNumericOnly"]
        : defaults.ticketNumericOnly,
    ticketPasswordLength: clampInteger(
      source["ticketPasswordLength"],
      defaults.ticketPasswordLength,
      4,
      16,
    ),
    ticketPasswordNumericOnly:
      typeof source["ticketPasswordNumericOnly"] === "boolean"
        ? source["ticketPasswordNumericOnly"]
        : defaults.ticketPasswordNumericOnly,
  };
}
