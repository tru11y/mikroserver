import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MikroTikClientFactory } from "../mikrotik-client/mikrotik-client.factory";
import { CredentialsService } from "../routers/credentials.service";
import { ConfigureHotspotDto } from "./dto/configure-hotspot.dto";
import { HotspotSetupTransaction } from "./hotspot-setup.transaction";

@Injectable()
export class HotspotSetupService {
  private readonly logger = new Logger(HotspotSetupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientFactory: MikroTikClientFactory,
    private readonly credentials: CredentialsService,
  ) {}

  async configure(
    routerId: string,
    ownerId: string,
    dto: ConfigureHotspotDto,
  ): Promise<void> {
    const router = await this.prisma.router.findFirst({
      where: { id: routerId, ownerId, deletedAt: null },
      include: { tunnel: true },
    });

    if (!router) {
      throw new NotFoundException("Routeur introuvable");
    }
    if (router.hotspotConfigured) {
      throw new ConflictException("Hotspot déjà configuré sur ce routeur");
    }
    if (
      !router.encryptedAgentPassword ||
      !router.credentialsIv ||
      !router.credentialsAuthTag
    ) {
      throw new ConflictException(
        "Identifiants agent non configurés — routeur non onboardé",
      );
    }

    const host = router.tunnel?.tunnelIp ?? router.wireguardIp;
    if (!host) {
      throw new ConflictException("Aucune IP tunnel disponible");
    }

    const password = this.credentials.decrypt({
      ciphertext: router.encryptedAgentPassword,
      iv: router.credentialsIv,
      authTag: router.credentialsAuthTag,
    });

    const client = await this.clientFactory.create({
      host,
      port: 443,
      username: router.agentUsername,
      password,
      useTls: true,
    });

    try {
      const tx = new HotspotSetupTransaction(client, dto);
      await tx.execute();

      await this.prisma.router.update({
        where: { id: routerId },
        data: {
          hotspotConfigured: true,
          hotspotInterface: dto.interfaceName,
          hotspotNetwork: dto.network,
        },
      });

      this.logger.log(
        `Hotspot configured on router ${routerId} (${dto.interfaceName}, ${dto.network})`,
      );
    } finally {
      await client.close();
    }
  }
}
