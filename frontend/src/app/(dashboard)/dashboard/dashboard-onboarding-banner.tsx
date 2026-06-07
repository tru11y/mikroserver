import Link from 'next/link';
import { Wifi } from 'lucide-react';

const STEPS = [
  { step: '1', title: 'Connecter un routeur', desc: 'IP + identifiants',   href: '/routers',           cta: 'Ajouter'    },
  { step: '2', title: 'Créer des forfaits',   desc: 'Offres + tarifs',     href: '/plans',             cta: 'Configurer' },
  { step: '3', title: 'Générer des tickets',  desc: 'Premiers vouchers',   href: '/vouchers/generate', cta: 'Démarrer'   },
] as const;

export function DashboardOnboardingBanner() {
  return (
    <aside
      aria-label="Guide de démarrage"
      className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-5 space-y-3"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <Wifi className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-base">Bienvenue sur MikroServer</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connectez votre premier routeur MikroTik pour commencer.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {STEPS.map((item) => (
          <Link
            key={item.step}
            href={item.href}
            className="group rounded-lg bg-card border p-3 hover:border-primary/50 hover:bg-card/80 active:scale-[0.98] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {item.step}
              </span>
              <span className="font-semibold text-xs">{item.title}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">{item.desc}</p>
            <span className="text-[11px] font-semibold text-primary group-hover:underline">
              {item.cta} →
            </span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
