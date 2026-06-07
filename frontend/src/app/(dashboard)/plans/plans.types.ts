export type TicketType = 'PIN' | 'USER_PASSWORD';
export type DurationMode = 'ELAPSED' | 'PAUSED';

export interface PlanTicketSettings {
  ticketType: TicketType;
  durationMode: DurationMode;
  ticketPrefix: string;
  ticketCodeLength: number;
  ticketNumericOnly: boolean;
  ticketPasswordLength: number;
  ticketPasswordNumericOnly: boolean;
  usersPerTicket: number;
}

export interface Plan {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
  priceXof: number;
  durationMinutes: number;
  downloadKbps?: number | null;
  uploadKbps?: number | null;
  dataLimitMb?: number | null;
  userProfile?: string | null;
  displayOrder?: number | null;
  isPopular?: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  ticketSettings: PlanTicketSettings;
}

export interface PlanFormData {
  name: string;
  description: string;
  priceXof: number;
  durationMinutes: number;
  downloadKbps: number;
  uploadKbps: number;
  dataLimitMb: number;
  userProfile: string;
  displayOrder: number;
  isPopular: boolean;
  ticketType: TicketType;
  durationMode: DurationMode;
  ticketPrefix: string;
  ticketCodeLength: number;
  ticketNumericOnly: boolean;
  ticketPasswordLength: number;
  ticketPasswordNumericOnly: boolean;
  usersPerTicket: number;
}
