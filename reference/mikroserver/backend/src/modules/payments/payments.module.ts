import { Module } from '@nestjs/common';
import { WaveProvider } from './providers/wave.provider';

@Module({
  providers: [WaveProvider],
  exports: [WaveProvider],
})
export class PaymentsModule {}
