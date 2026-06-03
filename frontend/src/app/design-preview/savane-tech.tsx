'use client';

import { kpis, sessions, revenue7d, routers, vouchers, customers, dailyGoal } from './mock-data';

const maxBar  = Math.max(...revenue7d.map((d) => d.amount));
const goalPct = Math.round((dailyGoal.current / dailyGoal.target) * 100);

const routerDot = {
  online:   { bg: '#2D8C4E', ring: '#EDFAF3', label: 'En ligne'   },
  degraded: { bg: '#D97706', ring: '#FFF8E1', label: 'Dégradé'    },
  offline:  { bg: '#DC2626', ring: '#FFF0F0', label: 'Hors ligne' },
};

const voucherChip = {
  active:    { bg: '#EDFAF3', text: '#2D8C4E', label: '● Actif'   },
  generated: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Prêt'      },
  expired:   { bg: '#F5F5F4', text: '#78716C', label: 'Expiré'    },
  revoked:   { bg: '#FFF0F0', text: '#DC2626', label: 'Révoqué'   },
};

export function SavaneTech() {
  const onlineCount = routers.filter((r) => r.status === 'online').length;

  return (
    <div className="min-h-screen" style={{ background: '#FFFBF5', fontFamily: "'DM Sans', 'Plus Jakarta Sans', system-ui, sans-serif" }}>
      {/* Topbar */}
      <header className="h-16 flex items-center justify-between px-6 border-b sticky top-0 z-10" style={{ background: '#FFFFFF', borderColor: '#E8D5B0' }}>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ background: '#E87722' }}>M</span>
            <span className="font-bold text-base" style={{ color: '#1A1208' }}>MikroServer</span>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {[
              { label: 'Tableau de bord', active: true  },
              { label: 'Routeurs',        active: false },
              { label: 'Sessions',        active: false },
              { label: 'Vouchers',        active: false },
              { label: 'Clients',         active: false },
              { label: 'Paramètres',      active: false },
            ].map((item) => (
              <button type="button" key={item.label} className="px-4 py-2 text-sm rounded-lg transition-colors relative font-medium"
                style={{ color: item.active ? '#E87722' : '#8C7355', background: item.active ? '#FFF3E8' : 'transparent' }}>
                {item.label}
                {item.active && <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full" style={{ background: '#E87722' }} />}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="text-sm px-4 py-2 rounded-xl font-semibold transition-colors" style={{ background: '#E87722', color: '#FFFFFF' }}>
            + Générer voucher
          </button>
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm" style={{ background: '#FFF3E8', color: '#E87722' }}>A</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Greeting */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm mb-0.5" style={{ color: '#8C7355' }}>Sam 31 mai 2026</p>
            <h1 className="text-2xl font-bold" style={{ color: '#1A1208' }}>Bonjour, Admin 👋</h1>
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: '#8C7355' }}>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {onlineCount}/{routers.length} routeurs actifs · 138 sessions
          </div>
        </div>

        {/* Hero — objectif journalier */}
        <div className="rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-5"
          style={{ background: 'linear-gradient(135deg, #E87722 0%, #F59332 50%, #EAB308 100%)' }}>
          <div>
            <p className="text-orange-100 text-sm mb-1">Revenus aujourd'hui</p>
            <p className="text-white text-4xl font-bold leading-none mb-1 tracking-tight">
              {dailyGoal.current.toLocaleString()} <span className="text-2xl font-normal text-orange-200">FCFA</span>
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-orange-100 text-sm">Objectif : {dailyGoal.target.toLocaleString()} FCFA</span>
              <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-bold">{goalPct}%</span>
            </div>
          </div>
          <div className="md:min-w-72 flex-1 max-w-md">
            <div className="h-3 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.25)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${goalPct}%`, background: 'white' }} />
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>Il reste {(dailyGoal.target - dailyGoal.current).toLocaleString()} FCFA</span>
              <span className="text-white font-medium">🎯 Objectif</span>
            </div>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-xl p-4 border-l-4 hover:shadow-md transition-shadow"
              style={{ background: '#FFFFFF', borderColor: kpi.up ? '#2D8C4E' : '#DC2626', boxShadow: '0 1px 4px rgba(26,18,8,0.06)' }}>
              <p className="text-xs mb-2 truncate" style={{ color: '#8C7355' }}>{kpi.label}</p>
              <p className="text-xl font-bold leading-none mb-1.5 truncate" style={{ color: '#1A1208' }}>{kpi.value}</p>
              <span className="text-xs font-semibold" style={{ color: kpi.up ? '#2D8C4E' : '#DC2626' }}>
                {kpi.up ? '↑' : '↓'} {kpi.trend} vs hier
              </span>
            </div>
          ))}
        </div>

        {/* Graphique + Routeurs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 rounded-2xl p-5 border" style={{ background: '#FFFFFF', borderColor: '#E8D5B0' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold" style={{ color: '#1A1208' }}>Revenus — 7 derniers jours</h3>
              <div className="flex gap-1">
                {['7j', '30j', '90j'].map((r, i) => (
                  <button type="button" key={r} className="text-xs px-2.5 py-1 rounded-lg font-medium transition-colors"
                    style={{ background: i === 0 ? '#FFF3E8' : 'transparent', color: i === 0 ? '#E87722' : '#8C7355' }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-3 h-32 mb-2">
              {revenue7d.map((d, i) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
                  <p className="text-xs font-bold" style={{ color: '#8C7355', fontSize: '10px' }}>
                    {Math.round(d.amount / 1000)}k
                  </p>
                  <div className="w-full rounded-t-lg transition-all hover:opacity-90 relative group cursor-pointer"
                    style={{ height: `${(d.amount / maxBar) * 100}px`, background: i === 6 ? '#E87722' : '#2D8C4E' }}>
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {d.amount.toLocaleString()} F
                    </div>
                  </div>
                  <span className="text-xs" style={{ color: '#8C7355' }}>{d.day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Routeurs */}
          <div className="rounded-2xl p-5 border" style={{ background: '#FFFFFF', borderColor: '#E8D5B0' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: '#1A1208' }}>Routeurs</h3>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#EDFAF3', color: '#2D8C4E' }}>
                {onlineCount}/{routers.length} en ligne
              </span>
            </div>
            <div className="space-y-2.5">
              {routers.map((r) => {
                const d = routerDot[r.status];
                return (
                  <div key={r.name} className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.bg }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: '#1A1208' }}>{r.name}</p>
                      {r.status !== 'offline' && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#F5EDD6' }}>
                            <div className="h-full rounded-full" style={{ width: `${r.cpu}%`, background: r.cpu > 75 ? '#DC2626' : r.cpu > 50 ? '#D97706' : '#2D8C4E' }} />
                          </div>
                          <span className="text-xs" style={{ color: '#8C7355' }}>{r.cpu}%</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold" style={{ color: r.sessions > 0 ? '#E87722' : '#8C7355' }}>
                        {r.sessions}
                      </span>
                      <span className="text-xs ml-1" style={{ color: '#8C7355' }}>sess.</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Vouchers + Clients */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Vouchers */}
          <div className="rounded-2xl border overflow-hidden" style={{ background: '#FFFFFF', borderColor: '#E8D5B0' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#E8D5B0' }}>
              <h3 className="text-sm font-bold" style={{ color: '#1A1208' }}>Vouchers récents</h3>
              <button type="button" className="text-xs font-semibold" style={{ color: '#E87722' }}>Voir tout →</button>
            </div>
            <div className="divide-y" style={{ borderColor: '#F5EDD6' }}>
              {vouchers.slice(0, 5).map((v) => {
                const chip = voucherChip[v.status];
                return (
                  <div key={v.code} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-mono font-semibold truncate" style={{ color: '#1A1208' }}>{v.code}</p>
                      <p className="text-xs truncate" style={{ color: '#8C7355' }}>
                        {v.plan}{v.router ? ` · ${v.router}` : ''}
                      </p>
                    </div>
                    <span className="ml-3 shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold"
                      style={{ background: chip.bg, color: chip.text }}>
                      {chip.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top clients */}
          <div className="rounded-2xl border overflow-hidden" style={{ background: '#FFFFFF', borderColor: '#E8D5B0' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#E8D5B0' }}>
              <h3 className="text-sm font-bold" style={{ color: '#1A1208' }}>Clients fidèles</h3>
              <button type="button" className="text-xs font-semibold" style={{ color: '#E87722' }}>Voir tout →</button>
            </div>
            <div className="divide-y" style={{ borderColor: '#F5EDD6' }}>
              {customers.map((c, rank) => (
                <div key={c.id} className={`flex items-center gap-3 px-5 py-3 ${c.status === 'blocked' ? 'opacity-50' : ''}`}>
                  <span className="text-sm font-bold w-5 shrink-0 text-right" style={{ color: rank < 3 ? '#E87722' : '#8C7355' }}>
                    {rank + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: '#FFF3E8', color: '#E87722' }}>
                    {c.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1A1208' }}>{c.name}</p>
                    <p className="text-xs truncate" style={{ color: '#8C7355' }}>{c.router} · {c.sessions} sessions</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold" style={{ color: '#1A1208' }}>{c.spent.toLocaleString()} F</p>
                    {c.status === 'blocked' && (
                      <p className="text-xs" style={{ color: '#DC2626' }}>Bloqué</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sessions table */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: '#FFFFFF', borderColor: '#E8D5B0' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#E8D5B0' }}>
            <h3 className="text-sm font-bold" style={{ color: '#1A1208' }}>Sessions actives</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: '#FFF3E8', color: '#E87722' }}>
                {sessions.length} sessions
              </span>
              <button type="button" className="text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors"
                style={{ borderColor: '#E8D5B0', color: '#8C7355' }}>
                CSV
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#FFFBF5', borderBottom: '1px solid #E8D5B0' }}>
                  {['Client', 'MAC', 'Routeur', 'Forfait', 'Durée', 'Données', 'Statut', 'Action'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: '#8C7355' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={s.id} style={{ borderBottom: i < sessions.length - 1 ? '1px solid #F5EDD6' : 'none' }}>
                    <td className="px-5 py-3.5 font-semibold text-sm" style={{ color: '#1A1208' }}>{s.client}</td>
                    <td className="px-5 py-3.5 font-mono text-xs" style={{ color: '#8C7355' }}>{s.mac}</td>
                    <td className="px-5 py-3.5 text-sm truncate max-w-[120px]" style={{ color: '#8C7355' }}>{s.router}</td>
                    <td className="px-5 py-3.5 text-sm" style={{ color: '#1A1208' }}>{s.plan}</td>
                    <td className="px-5 py-3.5 font-mono text-xs" style={{ color: '#8C7355' }}>{s.duration}</td>
                    <td className="px-5 py-3.5 font-mono text-xs" style={{ color: '#8C7355' }}>{s.data}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                        style={{
                          background: s.status === 'active' ? '#EDFAF3' : '#FFF8E1',
                          color:      s.status === 'active' ? '#2D8C4E' : '#E87722',
                        }}>
                        {s.status === 'active' ? '● Actif' : '⚠ Expire'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button type="button" className="text-xs font-medium px-3 py-1 rounded-lg transition-colors"
                        style={{ color: '#DC2626', background: '#FFF0F0' }}>
                        Couper
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
