'use client';

import { kpis, sessions, revenue30d, routers, vouchers, customers } from './mock-data';

// SVG area chart — pur Tailwind/SVG, pas de recharts
function AreaChart({ data, color, gId }: { data: number[]; color: string; gId: string }) {
  const max = Math.max(...data);
  const W = 600; const H = 80;
  const step = W / (data.length - 1);
  const pts = data.map((v, i) => [+(i * step).toFixed(1), +(H - 6 - (v / max) * (H - 12)).toFixed(1)] as [number, number]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('');
  const area = `${line}L${W},${H}L0,${H}Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const routerStatusStyle = {
  online:   { dot: 'bg-emerald-500', badge: 'text-emerald-700 bg-emerald-50', label: 'En ligne'  },
  degraded: { dot: 'bg-amber-400',   badge: 'text-amber-700 bg-amber-50',    label: 'Dégradé'   },
  offline:  { dot: 'bg-red-400',     badge: 'text-red-600 bg-red-50',        label: 'Hors ligne' },
};

const voucherStatusStyle = {
  active:    { bg: 'bg-emerald-50',  text: 'text-emerald-700', label: 'Actif'     },
  generated: { bg: 'bg-blue-50',     text: 'text-blue-700',    label: 'Généré'    },
  expired:   { bg: 'bg-slate-100',   text: 'text-slate-500',   label: 'Expiré'    },
  revoked:   { bg: 'bg-red-50',      text: 'text-red-600',     label: 'Révoqué'   },
};

export function CorporateSlate() {
  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0 shadow-sm">
        <div className="h-14 flex items-center px-5 border-b border-slate-200">
          <span className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold mr-2">M</span>
          <span className="text-slate-800 font-semibold text-sm">MikroServer</span>
        </div>
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {[
            { icon: '⊞', label: 'Dashboard',    active: true  },
            { icon: '⬡', label: 'Routeurs'                   },
            { icon: '◉', label: 'Sessions'                    },
            { icon: '🎫', label: 'Vouchers'                   },
            { icon: '👥', label: 'Clients'                    },
            { icon: '📊', label: 'Analytics'                  },
            { icon: '⚙', label: 'Paramètres'                  },
          ].map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                item.active
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="w-4 text-center text-sm">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        {/* Usage bar */}
        <div className="mx-3 mb-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
          <p className="text-xs text-blue-600 font-medium mb-1">Réseau actif</p>
          <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: '71%' }} />
          </div>
          <p className="text-xs text-blue-500 mt-1">5/7 routeurs · 138 sessions</p>
        </div>
        <div className="p-3 border-t border-slate-200">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 cursor-pointer">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">A</div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">Admin</p>
              <p className="text-xs text-slate-400 truncate">Super Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="font-medium text-slate-800">Dashboard</span>
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-400">Sam 31 mai 2026</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-xs text-slate-500 border border-slate-200 px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors">
              Exporter CSV
            </button>
            <button className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors font-medium flex items-center gap-1.5">
              <span className="text-base leading-none">+</span> Générer voucher
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6 space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-5 gap-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="bg-white border border-slate-200 rounded-lg p-4 hover:-translate-y-0.5 transition-transform shadow-sm">
                <p className="text-xs text-slate-500 mb-2 truncate">{kpi.label}</p>
                <p className="text-xl font-bold font-mono text-slate-900 leading-none mb-2 truncate">{kpi.value}</p>
                <span className={`inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full ${kpi.up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {kpi.up ? '↑' : '↓'} {kpi.trend}
                </span>
              </div>
            ))}
          </div>

          {/* Chart + Routeurs */}
          <div className="grid grid-cols-3 gap-5">
            {/* Area chart — 30j */}
            <div className="col-span-2 bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-800">Revenus — 30 derniers jours</h3>
                <div className="flex items-center gap-1">
                  {['7j', '30j', '90j'].map((r, i) => (
                    <button key={r} className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${i === 1 ? 'bg-blue-50 text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-2xl font-bold font-mono text-slate-900">1 349 500 <span className="text-sm font-normal text-slate-400">FCFA</span></p>
                <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-full">↑ +14% vs mois dernier</span>
              </div>
              <div className="h-20">
                <AreaChart data={revenue30d} color="#2563EB" gId="corp-area" />
              </div>
              <div className="flex justify-between mt-1 text-xs text-slate-300">
                <span>1 mai</span>
                <span>15 mai</span>
                <span>31 mai</span>
              </div>
            </div>

            {/* Routeurs */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-800">Routeurs</h3>
                <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                  {routers.filter(r => r.status === 'online').length}/{routers.length} en ligne
                </span>
              </div>
              <div className="space-y-2">
                {routers.map((r) => {
                  const s = routerStatusStyle[r.status];
                  return (
                    <div key={r.name} className="flex items-center justify-between py-1.5 group">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                        <span className="text-xs text-slate-700 truncate">{r.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {r.status !== 'offline' && (
                          <div className="flex items-center gap-1">
                            <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${r.cpu > 75 ? 'bg-red-400' : r.cpu > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                style={{ width: `${r.cpu}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-400 w-8 text-right">{r.cpu}%</span>
                          </div>
                        )}
                        <span className="text-xs font-mono text-slate-400 w-4 text-right">{r.sessions}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Vouchers + Top clients */}
          <div className="grid grid-cols-2 gap-5">
            {/* Vouchers récents */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800">Vouchers récents</h3>
                <button className="text-xs text-blue-600 font-medium hover:underline">Voir tout →</button>
              </div>
              <div className="divide-y divide-slate-50">
                {vouchers.slice(0, 5).map((v) => {
                  const s = voucherStatusStyle[v.status];
                  return (
                    <div key={v.code} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono text-xs text-slate-800 font-semibold">{v.code}</span>
                        <span className="text-xs text-slate-400 hidden sm:block">{v.plan}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {v.router && <span className="text-xs text-slate-400 truncate max-w-24">{v.router}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}>{s.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top clients */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-800">Top clients</h3>
                <button className="text-xs text-blue-600 font-medium hover:underline">Voir tout →</button>
              </div>
              <div className="divide-y divide-slate-50">
                {customers.map((c, i) => (
                  <div key={c.id} className={`flex items-center justify-between px-5 py-2.5 hover:bg-slate-50 transition-colors ${c.status === 'blocked' ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                        {c.name[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">{c.name}</p>
                        <p className="text-xs text-slate-400 truncate">{c.router}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-xs font-mono font-semibold text-slate-800">{c.spent.toLocaleString()} F</p>
                      <p className="text-xs text-slate-400">{c.sessions} sessions</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sessions table */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">Sessions actives</h3>
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 border border-slate-200 px-3 py-1.5 rounded-md bg-slate-50">
                  <span>🔍</span>
                  <input className="bg-transparent outline-none w-24 placeholder-slate-400 text-xs" placeholder="Filtrer..." />
                </div>
                <button className="text-xs text-slate-500 border border-slate-200 px-3 py-1.5 rounded-md hover:bg-slate-50">CSV</button>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Client', 'MAC', 'Routeur', 'Forfait', 'Durée', 'Données', 'Statut', ''].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-left text-xs font-medium text-slate-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-slate-800 font-medium text-xs">{s.client}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">{s.mac}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{s.router}</td>
                    <td className="px-5 py-3 text-xs text-slate-600">{s.plan}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{s.duration}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{s.data}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {s.status === 'active' ? 'Actif' : '⚠ Expire'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button className="text-xs text-red-500 hover:text-red-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity">Couper</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
