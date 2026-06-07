'use client';

import { clsx } from 'clsx';
import { Crown, AlertTriangle, Zap } from 'lucide-react';
import Link from 'next/link';
import type { UsageLevel } from './use-subscription-data';

interface CtaVariant {
  containerCls: string;
  iconCls: string;
  Icon: typeof Crown;
  title: string;
  description: string;
  primaryLabel: string;
}

const CTA_VARIANTS: Record<UsageLevel | 'expired', CtaVariant> = {
  low: {
    containerCls: 'border bg-card',
    iconCls:      'bg-muted text-muted-foreground',
    Icon:         Crown,
    title:        'Modifier votre plan',
    description:  'Les changements de plan sont effectués manuellement. Contactez votre administrateur pour toute demande.',
    primaryLabel: 'Contacter l\'admin',
  },
  medium: {
    containerCls: 'border-[hsl(var(--warning)/0.3)] bg-[hsl(var(--warning)/0.05)] border',
    iconCls:      'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]',
    Icon:         AlertTriangle,
    title:        'Vous approchez de vos limites',
    description:  'Vous commencez à utiliser une part significative de votre plan. Pensez à en discuter avec votre administrateur.',
    primaryLabel: 'Contacter l\'admin',
  },
  high: {
    containerCls: 'border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.08)] border',
    iconCls:      'bg-[hsl(var(--warning)/0.2)] text-[hsl(var(--warning))]',
    Icon:         AlertTriangle,
    title:        'Limite bientôt atteinte',
    description:  'Vous utilisez plus de 80% de vos ressources disponibles. Contactez votre administrateur pour un upgrade.',
    primaryLabel: 'Demander un upgrade',
  },
  critical: {
    containerCls: 'border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.08)] border shadow-[var(--shadow-glow)]',
    iconCls:      'bg-[hsl(var(--primary)/0.15)] text-[hsl(var(--primary))]',
    Icon:         Zap,
    title:        'Limite critique',
    description:  'Vous avez atteint ou dépassé 90% de vos ressources. Contactez immédiatement votre administrateur pour éviter toute interruption.',
    primaryLabel: 'Upgrade urgent',
  },
  expired: {
    containerCls: 'border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.06)] border',
    iconCls:      'bg-[hsl(var(--destructive)/0.15)] text-[hsl(var(--destructive))]',
    Icon:         AlertTriangle,
    title:        'Renouveler votre abonnement',
    description:  'Votre plan a expiré. Contactez votre administrateur pour le renouvellement.',
    primaryLabel: 'Renouveler maintenant',
  },
};

interface SubscriptionCtaBlockProps {
  usageLevel: UsageLevel;
  isExpired: boolean;
}

export function SubscriptionCtaBlock({ usageLevel, isExpired }: SubscriptionCtaBlockProps) {
  const variantKey = isExpired ? 'expired' : usageLevel;
  const v = CTA_VARIANTS[variantKey];

  return (
    <aside
      aria-label="Gestion du plan"
      className={clsx('rounded-xl p-5', v.containerCls)}
    >
      <div className="flex items-start gap-3">
        <div
          className={clsx('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', v.iconCls)}
          aria-hidden="true"
        >
          <v.Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{v.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{v.description}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="mailto:admin@mikroserver.app"
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold',
                'transition-all duration-200 ease-out active:scale-[0.98]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                usageLevel === 'critical' || isExpired
                  ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary-hover))] hover:shadow-[var(--shadow-glow)]'
                  : 'border bg-card hover:bg-muted/50',
              )}
            >
              {v.primaryLabel}
            </a>
            <Link
              href="/settings"
              className={[
                'inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium',
                'transition-all duration-200 ease-out active:scale-[0.98]',
                'hover:bg-muted/50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              ].join(' ')}
            >
              Réglages plateforme
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
