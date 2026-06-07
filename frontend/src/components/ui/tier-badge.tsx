import { clsx } from 'clsx';
import { Building2, Crown, Sparkles, Zap } from 'lucide-react';
import type { ElementType } from 'react';

type TierSlug = 'decouverte' | 'entrepreneur' | 'pro' | 'enterprise';

const SLUG_CFG: Record<TierSlug, { className: string; Icon: ElementType }> = {
  decouverte:   { Icon: Zap,       className: 'border-border text-muted-foreground bg-muted' },
  entrepreneur: { Icon: Crown,     className: 'border-[hsl(var(--info)/0.3)] bg-[hsl(var(--info)/0.1)] text-[hsl(var(--info))]' },
  pro:          { Icon: Sparkles,  className: 'border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]' },
  enterprise:   { Icon: Building2, className: 'border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]' },
};

interface TierBadgeProps {
  name: string;
  isFree: boolean;
  size?: 'sm' | 'md';
  slug?: string;
}

export function TierBadge({ name, isFree, size = 'md', slug }: TierBadgeProps) {
  const slugCfg = slug ? SLUG_CFG[slug as TierSlug] : undefined;
  const Icon = slugCfg?.Icon ?? (isFree ? Zap : Crown);
  const colorClass = slugCfg?.className ?? (
    isFree
      ? 'border-border text-muted-foreground bg-muted'
      : 'border-[hsl(var(--primary)/0.25)] text-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]'
  );

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border font-semibold uppercase tracking-wider',
        colorClass,
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
      )}
    >
      <Icon className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} aria-hidden="true" />
      {name}
    </span>
  );
}
