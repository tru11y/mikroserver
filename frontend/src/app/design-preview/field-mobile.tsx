'use client';

import { kpis, sessions, routers, vouchers, dailyGoal } from './mock-data';

const goalPct = Math.round((dailyGoal.current / dailyGoal.target) * 100);

const statusColor = {
  online:   { bg: 'bg-emerald-500', shadow: 'shadow-emerald-500/30', text: 'text-emerald-400', label: 'En ligne'  },
  degraded: { bg: 'bg-amber-400',   shadow: 'shadow-amber-400/30',   text: 'text-amber-400',   label: 'Dégradé'   },
  offline:  { bg: 'bg-red-500',     shadow: 'shadow-red-500/30',     text: 'text-red-400',     label: 'Hors ligne' },
};

const voucherBadge = {
  active:    'bg-emerald-900 text-emerald-400',
  generated: 'bg-blue-900 text-blue-400',
  expired:   'bg-slate-700 text-slate-400',
  revoked:   'bg-red-900 text-red-400',
};

export function FieldMobile() {
  const onlineCount = routers.filter((r) => r.status === 'online').length;

  return (
    <div className="flex justify-center items-start bg-slate-900 min-h-screen py-6 px-4">
      {/* Phone shell */}
      <div
        className="w-full max-w-[360px] bg-gray-950 rounded-[2.5rem] overflow-hidden flex flex-col border border-gray-700/60"
        style={{ minHeight: '780px', boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)' }}
      >
        {/* Status bar */}
        <div className="flex justify-between items-center px-6 pt-4 pb-1">
          <span className="text-white/70 text-xs font-medium">14:57</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-semibold">LIVE</span>
          </div>
        </div>

        {/* Header */}
        <header className="flex items-center justify-between px-5 py-3">
          <div>
            <p className="text-gray-500 text-xs">Tableau de bord</p>
            <h1 className="text-white text-xl font-bold tracking-tight">MikroServer</h1>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 text-sm">🔔</button>
            <button type="button" className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold">A</button>
          </div>
        </header>

        {/* Hero card — revenu + objectif */}
        <div className="mx-4 mb-4 rounded-2xl p-5 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-8 translate-x-8" />
          <p className="text-emerald-100 text-xs mb-1">Revenus aujourd'hui</p>
          <p className="text-white text-4xl font-bold leading-none mb-3 tracking-tight">
            {dailyGoal.current.toLocaleString()} <span className="text-2xl font-normal text-emerald-200">F</span>
          </p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-emerald-100 text-xs">Objectif {dailyGoal.target.toLocaleString()} FCFA</span>
            <span className="text-white text-xs font-bold">{goalPct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-emerald-800/50">
            <div className="h-full bg-white rounded-full" style={{ width: `${goalPct}%` }} />
          </div>
          <div className="flex gap-3 mt-3">
            <div className="text-center">
              <p className="text-white text-lg font-bold leading-none">{kpis[1].value}</p>
              <p className="text-emerald-200 text-xs">sessions</p>
            </div>
            <div className="w-px bg-emerald-700/50" />
            <div className="text-center">
              <p className="text-white text-lg font-bold leading-none">{onlineCount}/{routers.length}</p>
              <p className="text-emerald-200 text-xs">routeurs</p>
            </div>
            <div className="w-px bg-emerald-700/50" />
            <div className="text-center">
              <p className="text-white text-lg font-bold leading-none">{kpis[3].value}</p>
              <p className="text-emerald-200 text-xs">vouchers</p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2 px-4 mb-4">
          {[
            { icon: '🎫', label: 'Créer\nvoucher',  bg: 'bg-indigo-900', accent: 'text-indigo-400' },
            { icon: '📡', label: 'Voir\nrouteurs',  bg: 'bg-slate-800',  accent: 'text-slate-300'  },
            { icon: '⚡', label: 'Sessions\nlive',  bg: 'bg-slate-800',  accent: 'text-slate-300'  },
          ].map((a) => (
            <button type="button" key={a.label} className={`${a.bg} rounded-2xl p-3 flex flex-col items-center gap-1.5 active:scale-95 transition-transform`}>
              <span className="text-2xl">{a.icon}</span>
              <span className={`text-xs font-medium ${a.accent} text-center leading-tight whitespace-pre`}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* Routeurs */}
        <div className="px-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white text-sm font-semibold">Routeurs</h2>
            <button type="button" className="text-emerald-400 text-xs font-medium">Tout voir →</button>
          </div>
          <div className="space-y-2">
            {routers.slice(0, 4).map((r) => {
              const s = statusColor[r.status];
              return (
                <div key={r.name} className="bg-gray-900 rounded-xl px-3 py-2.5 flex items-center justify-between border border-gray-800">
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${s.bg} shadow-sm ${s.shadow}`} />
                    <div>
                      <p className="text-white text-sm font-medium leading-tight">{r.name}</p>
                      <p className={`text-xs ${s.text}`}>{s.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {r.status !== 'offline' && (
                      <div className="flex flex-col items-end gap-0.5">
                        <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${r.cpu > 75 ? 'bg-red-400' : r.cpu > 50 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                            style={{ width: `${r.cpu}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">CPU {r.cpu}%</span>
                      </div>
                    )}
                    <div className="text-right">
                      <p className="text-white text-sm font-bold leading-none">{r.sessions}</p>
                      <p className="text-gray-500 text-xs">sess.</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vouchers récents */}
        <div className="px-4 mb-20">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white text-sm font-semibold">Vouchers</h2>
            <span className="bg-indigo-800 text-indigo-300 text-xs px-2 py-0.5 rounded-full font-bold">
              {vouchers.filter((v) => v.status === 'active').length} actifs
            </span>
          </div>
          <div className="space-y-2">
            {vouchers.slice(0, 4).map((v) => (
              <div key={v.code} className="bg-gray-900 rounded-xl px-3 py-2.5 flex items-center justify-between border border-gray-800">
                <div className="min-w-0">
                  <p className="text-white text-sm font-mono font-semibold">{v.code}</p>
                  <p className="text-gray-500 text-xs">{v.plan}{v.router ? ` · ${v.router}` : ''}</p>
                </div>
                <span className={`ml-2 shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${voucherBadge[v.status]}`}>
                  {v.status === 'active' ? '● Actif' : v.status === 'generated' ? 'Prêt' : v.status === 'expired' ? 'Expiré' : 'Révoqué'}
                </span>
              </div>
            ))}
          </div>

          {/* État vide — exemple */}
          <div className="mt-3 rounded-xl border border-dashed border-gray-700 px-4 py-5 flex flex-col items-center gap-2">
            <span className="text-2xl">📭</span>
            <p className="text-gray-500 text-xs text-center">Aucune session expirante<br/>tout est sous contrôle</p>
          </div>
        </div>

        {/* FAB */}
        <button
          type="button"
          className="absolute bottom-20 right-8 w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center text-white text-2xl font-light active:scale-95 transition-transform"
          style={{ boxShadow: '0 8px 24px rgba(16,185,129,0.4)' }}
        >
          +
        </button>

        {/* Bottom nav */}
        <nav className="absolute bottom-0 left-0 right-0 max-w-[360px] mx-auto h-16 bg-gray-900 border-t border-gray-800 flex items-center justify-around px-2">
          {[
            { icon: '⊞', label: 'Home',     active: true  },
            { icon: '⬡', label: 'Routeurs', active: false },
            { icon: '🎫', label: 'Vouchers', active: false },
            { icon: '👥', label: 'Clients',  active: false },
            { icon: '⚙', label: 'Config',   active: false },
          ].map((tab) => (
            <button type="button" key={tab.label} className="flex flex-col items-center gap-0.5 px-3 py-1">
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className={`text-xs font-medium ${tab.active ? 'text-emerald-400' : 'text-gray-600'}`}>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
