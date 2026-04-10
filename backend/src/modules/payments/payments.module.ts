import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WaveProvider } from "./providers/wave.provider";
import { MockProvider } from "./providers/mock.provider";
import { CinetPayProvider } from "./providers/cinetpay.provider";
import { PaymentProviderRegistry } from "./payment-provider.factory";

@Module({
  providers: [
    WaveProvider,
    MockProvider,
    CinetPayProvider,
    {
      provide: PaymentProviderRegistry,
      useFactory: (
        waveProvider: WaveProvider,
        mockProvider: MockProvider,
        cinetPayProvider: CinetPayProvider,
        configService: ConfigService,
      ) => {
        return new PaymentProviderRegistry(
          waveProvider,
          mockProvider,
          cinetPayProvider,
          configService,
        );
      },
      inject: [WaveProvider, MockProvider, CinetPayProvider, ConfigService],
    },
  ],
  exports: [
    WaveProvider,
    MockProvider,
    CinetPayProvider,
    PaymentProviderRegistry,
  ],
})
export class PaymentsModule {}
