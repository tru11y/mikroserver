import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentProviderRegistry } from "../payments/payment-provider.factory";
import { ConfigService } from "@nestjs/config";
import {
  TransactionStatus,
  PaymentProvider,
  Transaction,
  UserRole,
} from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { addMinutes } from "date-fns";
import { nanoid } from "nanoid";
import { scopeTransactionToOwner } from "../../common/helpers/tenant-scope.helper";

export interface InitiatePaymentInput {
  planId: string;
  customerPhone: string;
  customerName?: string;
  provider?: string; // Optionnel : 'MOCK' ou 'WAVE'
  idempotencyKey?: string;
}

export interface TransactionListOptions {
  status?: TransactionStatus;
  page: number;
  limit: number;
  from?: Date;
  to?: Date;
  actor?: { sub: string; role: UserRole };
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);
  private readonly expiryMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentRegistry: PaymentProviderRegistry,
    private readonly configService: ConfigService,
  ) {
    this.expiryMinutes = this.configService.get<number>(
      "security.transactionExpiryMinutes",
      30,
    );
  }

  private resolveSuccessUrl(): string {
    return (
      this.configService.get<string>("wave.successUrl") ??
      this.configService.get<string>("cinetpay.returnUrl") ??
      "http://localhost:3001/portal/payment/success"
    );
  }

  private resolveErrorUrl(): string {
    return (
      this.configService.get<string>("wave.errorUrl") ??
      this.configService.get<string>("cinetpay.returnUrl") ??
      "http://localhost:3001/portal/payment/error"
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
      where: { id: input.planId, deletedAt: null, status: "ACTIVE" },
    });

    if (!plan)
      throw new NotFoundException(`Plan ${input.planId} not found or inactive`);

    // Générer une référence unique
    const reference = `MS-${nanoid(12).toUpperCase()}`;
    const idempotencyKey = input.idempotencyKey ?? uuidv4();
    const expiresAt = addMinutes(new Date(), this.expiryMinutes);

    // Déterminer le provider (celui passé en paramètre, ou celui par défaut dans la config)
    const providerType =
      (input.provider?.toUpperCase() as PaymentProvider) ||
      PaymentProvider.WAVE;
    const provider = this.paymentRegistry.getProvider(providerType);

    // Créer l'enregistrement de transaction AVANT d'appeler le provider
    const transaction = await this.prisma.transaction.create({
      data: {
        reference,
        planId: plan.id,
        customerPhone: input.customerPhone,
        customerName: input.customerName,
        amountXof: plan.priceXof,
        status: TransactionStatus.PENDING,
        provider: providerType,
        idempotencyKey,
        expiresAt,
      },
    });

    // Appeler le provider pour créer la session de paiement
    let paymentOutput;
    try {
      paymentOutput = await provider.createPayment({
        reference,
        idempotencyKey,
        amountXof: plan.priceXof,
        customerPhone: input.customerPhone,
        customerName: input.customerName,
        description: `MikroServer - ${plan.name}`,
        successUrl: this.resolveSuccessUrl(),
        errorUrl: this.resolveErrorUrl(),
      });
    } catch (error) {
      // Marquer la transaction comme échouée si l'appel au provider échoue
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.FAILED,
          failedAt: new Date(),
          failureReason:
            error instanceof Error ? error.message : "Provider API error",
        },
      });
      throw error;
    }

    // Mettre à jour la transaction avec la référence externe et l'URL de paiement
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
      `Payment initiated: ref=${reference} plan=${plan.name} phone=${input.customerPhone} provider=${providerType}`,
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
    const tenantScope = opts.actor
      ? scopeTransactionToOwner(opts.actor.sub, opts.actor.role)
      : {};

    const where = {
      ...tenantScope,
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.from || opts.to
        ? { createdAt: { gte: opts.from, lte: opts.to } }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: { plan: { select: { name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { data, total, page: opts.page, limit: opts.limit };
  }

  async getPortalStatus(id: string): Promise<{
    status: string;
    voucherCode: string | null;
  }> {
    const tx = await this.prisma.transaction.findUnique({
      where: { id },
      select: {
        status: true,
        voucher: { select: { code: true } },
      },
    });

    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);

    return {
      status: tx.status,
      voucherCode: tx.voucher?.code ?? null,
    };
  }

  async findOne(
    id: string,
    actor: { sub: string; role: string },
  ): Promise<Transaction> {
    const tenantScope =
      actor.role === UserRole.SUPER_ADMIN
        ? {}
        : scopeTransactionToOwner(actor.sub, actor.role as UserRole);

    // Using findFirst with tenant scope in where — returns null if not owned (→ 404).
    const tx = await this.prisma.transaction.findFirst({
      where: { id, ...tenantScope },
      include: {
        plan: true,
        voucher: true,
        webhookEvents: { orderBy: { receivedAt: "desc" }, take: 10 },
      },
    });

    if (!tx) throw new NotFoundException(`Transaction ${id} not found`);
    return tx;
  }
}
