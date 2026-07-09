interface PriceLabelProps {
  amount: number;
  currency?: string;
  locale?: string;
  className?: string;
}

const fmt = new Intl.NumberFormat('fr-CI', {
  style: 'currency',
  currency: 'XOF',
  maximumFractionDigits: 0,
});

export function PriceLabel({ amount, currency, locale, className }: PriceLabelProps) {
  const formatted =
    currency || locale
      ? new Intl.NumberFormat(locale ?? 'fr-CI', {
          style: 'currency',
          currency: currency ?? 'XOF',
          maximumFractionDigits: 0,
        }).format(amount)
      : fmt.format(amount);

  return <span className={className}>{formatted}</span>;
}
