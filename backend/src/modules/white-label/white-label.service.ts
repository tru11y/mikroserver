import { Injectable, BadRequestException } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService, AuditLogInput } from "../audit/audit.service";

export class UpdateWhiteLabelDto {
  platformName?: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string; // must be valid hex #RRGGBB
  accentColor?: string;
  supportEmail?: string;
  supportPhone?: string;
  footerText?: string;
  customCss?: string;
}

const DEFAULT_CONFIG = {
  platformName: "MikroServer",
  logoUrl: null,
  faviconUrl: null,
  primaryColor: "#6366f1",
  accentColor: "#8b5cf6",
  supportEmail: null,
  supportPhone: null,
  footerText: null,
  customCss: null,
};

@Injectable()
export class WhiteLabelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getConfig(userId: string) {
    const config = await this.prisma.whiteLabelConfig.findUnique({
      where: { userId },
    });
    if (!config) {
      return DEFAULT_CONFIG;
    }
    return config;
  }

  async getPublicConfig(userId: string) {
    // Public endpoint — only safe fields, customCss excluded for security
    const config = await this.getConfig(userId);
    const { customCss: _css, ...safe } = config as typeof DEFAULT_CONFIG & {
      customCss?: string | null;
    };
    return safe;
  }

  async update(userId: string, dto: UpdateWhiteLabelDto, requestIp?: string) {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    if (dto.primaryColor && !hexRegex.test(dto.primaryColor)) {
      throw new BadRequestException(
        "primaryColor must be a valid hex color (#RRGGBB)",
      );
    }
    if (dto.accentColor && !hexRegex.test(dto.accentColor)) {
      throw new BadRequestException(
        "accentColor must be a valid hex color (#RRGGBB)",
      );
    }
    if (dto.customCss) {
      if (dto.customCss.length > 5000) {
        throw new BadRequestException(
          "customCss must be 5000 characters or less",
        );
      }
      this.validateCustomCss(dto.customCss);
    }

    const config = await this.prisma.whiteLabelConfig.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });

    const auditInput: AuditLogInput = {
      action: AuditAction.WHITE_LABEL_UPDATED,
      userId,
      entityType: "WhiteLabelConfig",
      entityId: config.id,
      newValues: { fields: Object.keys(dto) },
      ipAddress: requestIp,
    };
    await this.auditService.log(auditInput);

    return config;
  }

  /**
   * Reject CSS that could be used for data exfiltration or script injection.
   * Patterns blocked: expression(), javascript: URLs, -moz-binding, @import,
   * </style> tag injection, and behavior: declarations.
   */
  private validateCustomCss(css: string): void {
    const dangerous = [
      /expression\s*\(/i, // IE CSS expressions (arbitrary JS)
      /url\s*\(\s*['"]?\s*javascript:/i, // javascript: URI in url()
      /-moz-binding/i, // XBL binding (Firefox)
      /behavior\s*:/i, // IE behavior property
      /@import/i, // External stylesheet import
      /<\/?\s*style/i, // Attempt to close/open <style> tag
      /<script/i, // Injected script tag
    ];

    for (const pattern of dangerous) {
      if (pattern.test(css)) {
        throw new BadRequestException(
          "customCss contains disallowed patterns. Avoid expression(), javascript: URLs, @import, and HTML tags.",
        );
      }
    }
  }
}
