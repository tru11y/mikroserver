import { Module, forwardRef } from '@nestjs/common';
import { VoucherService } from './voucher.service';
import { VouchersController } from './vouchers.controller';
import { PdfService } from './pdf.service';
import { QueueModule } from '../queue/queue.module';
import { RoutersModule } from '../routers/routers.module';

@Module({
  imports: [forwardRef(() => QueueModule), RoutersModule],
  providers: [VoucherService, PdfService],
  controllers: [VouchersController],
  exports: [VoucherService, PdfService],
})
export class VouchersModule {}
