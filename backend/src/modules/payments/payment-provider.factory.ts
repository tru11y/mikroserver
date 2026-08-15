import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IPaymentProvider } from "./interfaces/payment-provider.interface";
import { MockProvider } from "./providers/mock.provider";

export type ProviderType = "MOCK";

/** Registry that holds injected provider instances and resolves them by type. */
@Injectable()
export class PaymentProviderRegistry {
  private readonly providers = new Map<string, IPaymentProvider>();

  constructor(
    private readonly mockProvider: MockProvider,
    private readonly configService: ConfigService,
  ) {
    this.providers.set("MOCK", mockProvider);
  }

  getProvider(type?: string): IPaymentProvider {
    const providerType =
      type?.toUpperCase() ||
      this.configService.get<string>("payment.provider", "MOCK");
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(
        `Payment provider "${providerType}" not registered. Available: ${Array.from(this.providers.keys()).join(", ")}`,
      );
    }
    return provider;
  }
}
