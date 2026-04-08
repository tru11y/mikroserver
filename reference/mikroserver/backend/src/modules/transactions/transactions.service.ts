import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WaveProvider } from '../payments/providers/wave.provider';
import { ConfigService } from '@nestjs/config';
import {
  TransactionStatus,
  PaymentProvider,
  Transaction,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { addMinutes } from 'date-fns';
import { nanoid } from 'nanoid';

export interface InitiatePaymentInput {
  planId: string;
  customerPhone: string;
  customerName?: string;
}

export interface TransactionListOptions {
  status?: TransactionStatus;
  page: number;
  limit: number;
  from?: Date;
  to?: Date;
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
  private readonly expiryMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly waveProvider: WaveProvider,
    private readonly configService: ConfigService,
  ) {
    this.expiryMinutes = this.configService.get<number>(
      'security.transactionExpiryMinutes',
      30,
    );
  }

  // ---------------------------------------------------------------------------
  // Initiate a payment (called from captive portal)
  // ---------------------------------------------------------------------------

  async initiatePayment(input: InitiatePaymentInput): Promise<{
    transaction: Transaction;
    paymentUrl: string;
  }> {
    const plan = await this.prisma.plan.findUnique({
      where: { id: input.planId, deletedAt: null, status: 'ACTIVE' },
    });

    if (!plan) throw new NotFoundException(`Plan ${input.planId} not found or inactive`);

    // Generate unique reference
    const reference = `MS-${nanoid(12).toUpperCase()}`;
    const idempotencyKey = uuidv4();
    const expiresAt = addMinutes(new Date(), this.expiryMinutes);

    // Create transaction record FIRST (before calling Wave)
    const transaction = await this.prisma.transaction.create({
      data: {
        reference,
        planId: plan.id,
        customerPhone: input.customerPhone,
        customerName: input.customerName,
        amountXof: plan.priceXof,
        status: TransactionStatus.PENDING,
        provider: PaymentProvider.WAVE,
        idempotencyKey,
        expiresAt,
      },
    });

    // Call Wave to create checkout session
    let paymentOutput;
    try {
      paymentOutput = await this.waveProvider.createPayment({
        reference,
        idempotencyKey,
        amountXof: plan.priceXof,
        customerPhone: input.customerPhone,
        customerName: input.customerName,
        description: `MikroServer - ${plan.name}`,
        successUrl: this.configService.getOrThrow<string>('wave.successUrl'),
        errorUrl: this.configService.getOrThrow<string>('wave.errorUrl'),
      });
    } catch (error) {
      // Mark transaction as failed if Wave call fails
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.FAILED,
          failedAt: new Date(),
          failureReason: error instanceof Error ? error.message : 'Wave API error',
        },
      });
      throw error;
    }

    // Update transaction with Wave reference and payment URL
    const updated = await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        externalReference: paymentOutput.providerReference,
        paymentUrl: paymentOutput.paymentUrl,
        status: TransactionStatus.PROCESSING,
        expiresAt: paymentOutput.expiresAt,
      },
    });

    this.logger.log(
      `Payment initiated: ref=${reference} plan=${plan.name} phone=${input.customerPhone}`,
    );

    return { transaction: updated, paymentUrl: paymentOutput.paymentUrl };
  }

  // ---------------------------------------------------------------------------
  // List transactions with pagination
  // ---------------------------------------------------------------------------

  async findAll(opts: TransactionListOptions): Promise<{
    data: Transaction[];
    total: number;
    page: number;
    limit: number;
  }> {
    const where = {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.from || opts.to
        ? { createdAt: { gte: opts.from, lte: opts.to } }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: { plan: { select: { name: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data, total, page: opts.page, limit: opts.limit };
  }

  async findOne(id: string): Promise<Transaction> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        plan: true,
        voucher: true,
        webhookEvents: { orderBy: { receivedAt: 'desc' }, take: 10 },
      },
    });

    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);
    return tx;
  }
}
