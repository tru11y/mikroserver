-- Add CINETPAY to PaymentProvider enum
-- Required for CinetPay webhook handler (Orange Money, MTN MoMo, etc.)
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'CINETPAY';
