'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Wifi,
  Clock3,
  BadgeDollarSign,
  Gauge,
  ShieldCheck,
  Ticket,
  Sparkles,
} from 'lucide-react';

interface PublicPlan {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  durationMinutes: number;
  priceXof: number;
  downloadKbps?: number | null;
  uploadKbps?: number | null;
  dataLimitMb?: number | null;
  isPopular: boolean;
}

function formatDuration(minutes: number): string {
  const hours = minutes / 60;
  if (hours < 24) return `${Number(hours.toFixed(hours % 1 === 0 ? 0 : 1))} h`;
  if (hours < 168) return `${Math.round(hours / 24)} jour(s) (${hours} h)`;
  return `${Math.round(minutes / 10080)} semaine(s)`;
}

function formatSpeed(kbps?: number | null): string {
  if (!kbps) return 'Illimite';
  return `${Number((kbps / 1024).toFixed(kbps % 1024 === 0 ? 0 : 1))} Mbps`;
}

function formatData(dataMb?: number | null): string {
  if (!dataMb) return 'Illimite';
  if (dataMb >= 1024) return `${(dataMb / 1024).toFixed(0)} Go`;
  return `${dataMb} Mo`;
}

export default function PortalClientPage({
  hotspotName,
  siteName,
}: {
  hotspotName: string;
  siteName: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['public-plans'],
    queryFn: () => api.plans.publicList(),
  });

  const plans: PublicPlan[] = (data as any)?.data?.data ?? [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_22%),linear-gradient(180deg,_#f7f2e8_0%,_#fbfaf7_44%,_#f4efe6_100%)] text-slate-900">
      <section className="mx-auto max-w-6xl px-6 py-10 md:px-8 md:py-14">
        <div className="overflow-hidden rounded-[32px] border border-slate-900/10 bg-white/85 shadow-[0_25px_80px_-35px_rgba(15,23,42,0.4)] backdrop-blur">
          <div className="border-b border-slate-900/8 px-6 py-5 md:px-10">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-700/20 bg-emerald-50 px-3 py-1 text-emerald-700">
                <Wifi className="h-4 w-4" />
                {hotspotName}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-slate-50 px-3 py-1 text-slate-600">
                <ShieldCheck className="h-4 w-4" />
                Portail SaaS de previsualisation
              </span>
            </div>

            <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_0.9fr]">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-amber-700">Hotspot public</p>
                <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
                  Une page SaaS propre pour presenter les forfaits sans toucher a la prod MikroTik.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                  Cette page est separee du portail hotspot actuel. Elle permet de preparer la future experience client
                  du site <span className="font-medium text-slate-900">{siteName}</span> sans modifier le
                  `html-directory` du routeur tant que la production tourne.
                </p>
                <div className="mt-6 flex flex-wrap gap-3 text-sm">
                  <span className="rounded-full bg-slate-900 px-4 py-2 font-medium text-white">Aucun changement sur le routeur</span>
                  <span className="rounded-full border border-slate-900/10 px-4 py-2 text-slate-700">Forfaits publics lisibles</span>
                  <span className="rounded-full border border-slate-900/10 px-4 py-2 text-slate-700">Pret pour un futur basculement</span>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-900/10 bg-slate-950 p-6 text-slate-50 shadow-inner">
                <div className="flex items-center gap-2 text-sm text-emerald-300">
                  <Sparkles className="h-4 w-4" />
                  Mode test terrain
                </div>
                <div className="mt-5 space-y-4 text-sm text-slate-300">
                  <p>1. Le client voit les forfaits et comprend l’offre.</p>
                  <p>2. Le vendeur remet un ticket genere par le SaaS.</p>
                  <p>3. Le client utilise ensuite le ticket sur la page hotspot actuelle.</p>
                </div>
                <div className="mt-6 rounded-2xl bg-white/5 p-4 text-sm">
                  <p className="font-medium text-white">Deja un ticket ?</p>
                  <p className="mt-2 text-slate-300">
                    Montre ton ticket au vendeur ou a l’administrateur s’il faut verifier sa validite avant connexion.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-8 md:px-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Forfaits disponibles</p>
                <h2 className="mt-2 text-2xl font-semibold">Catalogue public</h2>
              </div>
              <div className="rounded-full border border-slate-900/10 bg-slate-50 px-4 py-2 text-sm text-slate-600">
                {plans.length} offre{plans.length > 1 ? 's' : ''} active{plans.length > 1 ? 's' : ''}
              </div>
            </div>

            {isLoading ? (
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-64 animate-pulse rounded-[24px] bg-slate-200/70" />
                ))}
              </div>
            ) : plans.length === 0 ? (
              <div className="mt-8 rounded-[24px] border border-dashed border-slate-900/20 bg-slate-50 p-10 text-center">
                <Ticket className="mx-auto h-10 w-10 text-slate-400" />
                <p className="mt-4 text-lg font-medium">Aucun forfait public pour le moment</p>
                <p className="mt-2 text-sm text-slate-500">
                  Active ou cree des forfaits dans le dashboard pour alimenter ce portail.
                </p>
              </div>
            ) : (
              <div className="mt-8 grid gap-5 lg:grid-cols-3">
                {plans.map((plan) => (
                  <article
                    key={plan.id}
                    className={`relative overflow-hidden rounded-[28px] border p-6 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)] ${
                      plan.isPopular
                        ? 'border-amber-400/50 bg-[linear-gradient(180deg,#fff9eb_0%,#fffdf8_100%)]'
                        : 'border-slate-900/10 bg-white'
                    }`}
                  >
                    {plan.isPopular && (
                      <span className="absolute right-4 top-4 rounded-full bg-amber-400 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950">
                        Populaire
                      </span>
                    )}
                    <p className="text-sm uppercase tracking-[0.22em] text-slate-500">{formatDuration(plan.durationMinutes)}</p>
                    <h3 className="mt-3 text-2xl font-semibold">{plan.name}</h3>
                    <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-600">
                      {plan.description || 'Forfait pret a vendre en ticket papier ou numerique.'}
                    </p>

                    <div className="mt-6 flex items-end gap-2">
                      <span className="text-4xl font-semibold">{plan.priceXof.toLocaleString('fr-FR')}</span>
                      <span className="pb-1 text-sm text-slate-500">FCFA</span>
                    </div>

                    <div className="mt-6 grid gap-3 text-sm">
                      <div className="flex items-center justify-between rounded-2xl bg-slate-950/[0.03] px-3 py-2">
                        <span className="flex items-center gap-2 text-slate-500"><Clock3 className="h-4 w-4" />Duree</span>
                        <span className="font-medium">{formatDuration(plan.durationMinutes)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl bg-slate-950/[0.03] px-3 py-2">
                        <span className="flex items-center gap-2 text-slate-500"><Gauge className="h-4 w-4" />Debit</span>
                        <span className="font-medium">{formatSpeed(plan.downloadKbps)} / {formatSpeed(plan.uploadKbps)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl bg-slate-950/[0.03] px-3 py-2">
                        <span className="flex items-center gap-2 text-slate-500"><BadgeDollarSign className="h-4 w-4" />Volume</span>
                        <span className="font-medium">{formatData(plan.dataLimitMb)}</span>
                      </div>
                    </div>

                    <div className="mt-6 rounded-[20px] border border-slate-900/10 bg-white/70 p-4 text-sm text-slate-600">
                      Demande ce forfait au vendeur ou a l’agent sur place. Le ticket te donnera un code et un mot de passe.
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-6 border-t border-slate-900/8 bg-slate-950 px-6 py-8 text-slate-100 md:grid-cols-3 md:px-10">
            {[
              {
                title: 'Choisir un forfait',
                body: 'Le client compare rapidement duree, debit et prix sans avoir a lire un ticket technique.',
              },
              {
                title: 'Recevoir un ticket',
                body: 'Le revendeur imprime ou envoie un code genere par le SaaS, sans changer le fonctionnement actuel du routeur.',
              },
              {
                title: 'Se connecter',
                body: 'La page hotspot existante reste active en production tant que tu n’as pas decide la bascule.',
              },
            ].map((item) => (
              <div key={item.title} className="rounded-[22px] border border-white/10 bg-white/5 p-5">
                <p className="text-sm uppercase tracking-[0.22em] text-emerald-300">{item.title}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
