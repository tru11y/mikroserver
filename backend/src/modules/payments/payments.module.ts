import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MockProvider } from "./providers/mock.provider";
import { PaymentProviderRegistry } from "./payment-provider.factory";

@Module({
  providers: [
    MockProvider,
    {
      provide: PaymentProviderRegistry,
      useFactory: (
        mockProvider: MockProvider,
        configService: ConfigService,
      ) => {
        return new PaymentProviderRegistry(mockProvider, configService);
      },
      inject: [MockProvider, ConfigService],
    },
  ],
  exports: [MockProvider, PaymentProviderRegistry],
})
export class PaymentsModule {}
