import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const MASKED = "••••••••";

const DEFAULTS: Record<
  string,
  { value: string; description: string; isSecret: boolean }
> = {
  "business.name": {
    value: "MikroServer",
    description: "Nom de la plateforme",
    isSecret: false,
  },
  "business.phone": {
    value: "",
    description: "Numéro de téléphone",
    isSecret: false,
  },
  "business.country": {
    value: "CI",
    description: "Pays (code ISO)",
    isSecret: false,
  },
  "wave.api_key": { value: "", description: "Clé API Wave CI", isSecret: true },
  "wave.webhook_secret": {
    value: "",
    description: "Secret webhook Wave HMAC-SHA256",
    isSecret: true,
  },
  "wave.merchant_name": {
    value: "",
    description: "Nom marchand Wave",
    isSecret: false,
  },
  "hotspot.default_profile": {
    value: "default",
    description: "Profil hotspot par défaut",
    isSecret: false,
  },
  "hotspot.default_server": {
    value: "hotspot1",
    description: "Serveur hotspot par défaut",
    isSecret: false,
  },
  "ticket.show_enterprise_name": {
    value: "true",
    description: "Afficher le nom entreprise sur le ticket",
    isSecret: false,
  },
  "ticket.enterprise_name": {
    value: "MikroServer",
    description: "Nom entreprise affiché sur le ticket",
    isSecret: false,
  },
  "ticket.show_wifi_name": {
    value: "true",
    description: "Afficher le nom du WiFi sur le ticket",
    isSecret: false,
  },
  "ticket.wifi_ssid": {
    value: "",
    description: "Nom du WiFi affiché sur le ticket",
    isSecret: false,
  },
  "ticket.show_price": {
    value: "true",
    description: "Afficher le prix sur le ticket",
    isSecret: false,
  },
  "ticket.currency_symbol": {
    value: "FCFA",
    description: "Symbole ou texte de devise",
    isSecret: false,
  },
  "ticket.show_ticket_number": {
    value: "true",
    description: "Afficher le numéro du ticket",
    isSecret: false,
  },
  "ticket.show_qr_code": {
    value: "false",
    description: "Afficher le QR code du ticket",
    isSecret: false,
  },
  "ticket.pdf_tickets_per_page": {
    value: "50",
    description: "Nombre de tickets par feuille PDF sans QR",
    isSecret: false,
  },
  "ticket.show_plan_name": {
    value: "true",
    description: "Afficher le nom du forfait sur le ticket",
    isSecret: false,
  },
  "ticket.show_created_at": {
    value: "false",
    description: "Afficher la date de création",
    isSecret: false,
  },
  "ticket.show_dns_name": {
    value: "false",
    description: "Afficher le DNS hotspot",
    isSecret: false,
  },
  "ticket.dns_name": {
    value: "",
    description: "DNS hotspot affiché sur le ticket",
    isSecret: false,
  },
  "ticket.keep_ticket_notice": {
    value: "true",
    description: "Afficher le message de conservation du ticket",
    isSecret: false,
  },
  "ticket.show_logo": {
    value: "false",
    description: "Afficher un logo sur le ticket",
    isSecret: false,
  },
  "ticket.logo_url": {
    value: "",
    description: "URL publique du logo du ticket",
    isSecret: false,
  },
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<
    Record<string, { value: string; description: string; isSecret: boolean }>
  > {
    const rows = await this.prisma.systemConfig.findMany();
    const dbMap: Record<string, (typeof rows)[0]> = {};
    for (const row of rows) dbMap[row.key] = row;

    const result: Record<
      string,
      { value: string; description: string; isSecret: boolean }
    > = {};
    for (const [key, def] of Object.entries(DEFAULTS)) {
      const row = dbMap[key];
      const raw = row?.value ?? def.value;
      result[key] = {
        value: def.isSecret && raw ? MASKED : raw,
        description: def.description,
        isSecret: def.isSecret,
      };
    }
    return result;
  }

  async update(updates: Record<string, string>, userId: string): Promise<void> {
    for (const [key, value] of Object.entries(updates)) {
      if (!(key in DEFAULTS)) continue;
      if (value === MASKED) continue; // skip unchanged secrets

      const def = DEFAULTS[key];
      await this.prisma.systemConfig.upsert({
        where: { key },
        create: {
          key,
          value,
          description: def.description,
          isSecret: def.isSecret,
          updatedBy: userId,
        },
        update: { value, updatedBy: userId },
      });
    }
  }

  async getRaw(key: string): Promise<string | null> {
    const row = await this.prisma.systemConfig.findUnique({ where: { key } });
    return row?.value ?? DEFAULTS[key]?.value ?? null;
  }
}
