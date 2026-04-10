import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

import * as Tpl from "./email-templates";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>("SMTP_HOST");
    const port = this.configService.get<number>("SMTP_PORT", 587);
    const user = this.configService.get<string>("SMTP_USER");
    const pass = this.configService.get<string>("SMTP_PASS");

    if (host && user) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`Email service ready (${host}:${port})`);
    } else {
      this.logger.warn("SMTP not configured — email notifications disabled");
    }
  }

  // ---------------------------------------------------------------------------
  // Core send primitive
  // ---------------------------------------------------------------------------

  async send(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) return false;

    const from = this.configService.get<string>(
      "SMTP_FROM",
      "MikroServer <noreply@mikroserver.app>",
    );

    try {
      await this.transporter.sendMail({ from, ...options });
      return true;
    } catch (err) {
      this.logger.error(`Email send failed: ${String(err)}`);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Operator emails
  // ---------------------------------------------------------------------------

  /**
   * Welcome email sent when a new operator account is created.
   */
  async sendWelcome(email: string, name: string): Promise<void> {
    const loginUrl = this.configService.get<string>(
      "APP_URL",
      "https://app.mikroserver.app",
    );

    await this.send({
      to: email,
      subject: `Bienvenue sur MikroServer, ${name} !`,
      html: Tpl.welcome(name, loginUrl),
    });
  }

  /**
   * Alert sent when a managed router loses connectivity.
   */
  async sendRouterOffline(toEmail: string, routerName: string): Promise<void> {
    const since = new Date().toLocaleString("fr-FR", {
      dateStyle: "long",
      timeStyle: "short",
    });

    await this.send({
      to: toEmail,
      subject: `Routeur "${routerName}" hors ligne`,
      html: Tpl.routerOffline(routerName, since),
    });
  }

  /**
   * Subscription expiry warning sent to the operator.
   *
   * @param planName  Display name of the SaaS tier (e.g. "Pro", "Business").
   */
  async sendSubscriptionExpiring(
    toEmail: string,
    daysLeft: number,
    planName: string,
  ): Promise<void> {
    const renewUrl = this.configService.get<string>(
      "APP_URL",
      "https://app.mikroserver.app",
    );

    await this.send({
      to: toEmail,
      subject: `Abonnement MikroServer expire dans ${daysLeft} jour(s)`,
      html: Tpl.subscriptionExpiring(planName, daysLeft, `${renewUrl}/billing`),
    });
  }

  /**
   * Daily statistics summary sent each morning to the operator.
   */
  async sendDailySummary(
    toEmail: string,
    stats: {
      date: string;
      revenueXof: number;
      newSessions: number;
      newCustomers: number;
      routersOnline: number;
      routersTotal: number;
    },
  ): Promise<void> {
    await this.send({
      to: toEmail,
      subject: `Résumé journalier MikroServer — ${stats.date}`,
      html: Tpl.dailySummary({
        revenue: stats.revenueXof,
        sessions: stats.newSessions,
        activeVouchers: stats.newCustomers, // mapped from callers' existing shape
        date: stats.date,
      }),
    });
  }

  // ---------------------------------------------------------------------------
  // Customer emails
  // ---------------------------------------------------------------------------

  /**
   * Voucher receipt delivered to the end customer after a successful payment.
   */
  async sendVoucherReceipt(
    email: string,
    code: string,
    planName: string,
    duration: string,
    price: number,
    validUntil: string,
  ): Promise<void> {
    const platformName = this.configService.get<string>(
      "PLATFORM_NAME",
      "MikroServer",
    );

    await this.send({
      to: email,
      subject: `Votre code WiFi — ${planName}`,
      html: Tpl.voucherReceipt(
        code,
        planName,
        duration,
        price,
        validUntil,
        platformName,
      ),
    });
  }

  // ---------------------------------------------------------------------------
  // Auth emails
  // ---------------------------------------------------------------------------

  /**
   * Password-reset OTP email.
   */
  async sendPasswordReset(
    toEmail: string,
    otpCode: string,
    expiresMinutes = 15,
  ): Promise<void> {
    await this.send({
      to: toEmail,
      subject: "Code de réinitialisation MikroServer",
      html: Tpl.passwordReset(otpCode, expiresMinutes),
    });
  }
}
