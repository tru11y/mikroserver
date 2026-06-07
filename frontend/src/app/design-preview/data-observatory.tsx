'use client';

import { kpis, sessions, revenueHourly, revenue30d, routers, alerts } from './mock-data';

const maxHourly = Math.max(...revenueHourly);
const max30d    = Math.max(...revenue30d);

// Heatmap sessions × heure × jour
const heatmap = Array.from({ length: 7 }, (_, di) =>
  Array.from({ length: 24 }, (_, hi) => {
    const seed = (di * 24 + hi + 7) * 13 % 97;
    return hi < 6 ? seed % 4 : hi < 22 ? (seed % 30) + 5 : seed % 8;
  })
);
const heatMax = Math.max(...heatmap.flat());
const days    = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const hours   = Array.from({ length: 24 }, (_, i) => (i % 6 === 0 ? `${i}h` : ''));

// Area SVG — 30 jours
function AreaLine({ data, max, color }: { data: number[]; max: number; color: string }) {
  const W = 600; const H = 60;
  const step = W / (data.length - 1);
  const pts = data.map((v, i) => [+(i * step).toFixed(1), +(H - 4 - (v / max) * (H - 8)).toFixed(1)] as [number, number]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('');
  const area = `${line}L${W},${H}L0,${H}Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id="obs-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#obs-area)" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const alertStyle = {
  error: { color: '#F87171', label: 'ERR'  },
  warn:  { color: '#F59E0B', label: 'WARN' },
  info:  { color: '#00D4FF', label: 'INFO' },
};

export function DataObservatory() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#060B14', color: '#E2EAF4', fontFamily: 'ui-monospace, monospace' }}>
      {/* Icon rail */}
      <aside className="w-12 flex flex-col items-center py-4 gap-4 border-r shrink-0" style={{ borderColor: '#1E2D45', background: '#0D1526' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: '#00D4FF', color: '#060B14' }}>M</div>
        {[
          { icon: '⊞', active: true },
          { icon: '⬡' }, { icon: '◉' }, { icon: '🎫' }, { icon: '👥' }, { icon: '⚠' }, { icon: '⚙' },
        ].map((item, i) => (
          <button type="button" key={i} className="w-9 h-9 rounded-lg flex items-center justify-center text-sm transition-colors"
            style={{ background: item.active ? 'rgba(0,212,255,0.12)' : 'transparent', color: item.active ? '#00D4FF' : '#627494' }}>
            {item.icon}
          </button>
        ))}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Control bar */}
        <header className="h-11 flex items-center justify-between px-5 border-b shrink-0" style={{ borderColor: '#1E2D45', background: '#0D1526' }}>
          <div className="flex items-center gap-3 text-xs" style={{ color: '#627494' }}>
            <button type="button" className="flex items-center gap-1.5 px-3 py-1 rounded" style={{ background: '#162035', color: '#E2EAF4' }}>
              📅 30 derniers jours ▾
            </button>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#00D4FF' }} />
              Auto-refresh 30s
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: '#627494' }}>
            <span>Synchro : 14:57:03</span>
            <button type="button" className="px-3 py-1 rounded font-medium" style={{ background: '#162035', color: '#00D4FF' }}>
              ⛶ Plein écran
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-5 gap-3">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-lg p-3 border" style={{ background: '#0D1526', borderColor: '#1E2D45' }}>
                <p className="text-xs mb-1.5 truncate" style={{ color: '#627494' }}>{kpi.label}</p>
                <p className="text-xl font-bold leading-none mb-1" style={{ color: '#00D4FF' }}>{kpi.value}</p>
                <span className="text-xs font-medium" style={{ color: kpi.up ? '#34D399' : '#F87171' }}>
                  {kpi.up ? '▲' : '▼'} {kpi.trend}
                </span>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-5 gap-4">
            {/* Area 30j */}
            <div className="col-span-3 rounded-lg p-4 border" style={{ background: '#0D1526', borderColor: '#1E2D45' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold" style={{ color: '#E2EAF4' }}>Revenus 30j — FCFA</h3>
                <span className="text-xs font-mono" style={{ color: '#34D399' }}>▲ +14%</span>
              </div>
              <p className="text-2xl font-bold mb-2" style={{ color: '#E2EAF4' }}>
                1 349 500 <span className="text-sm font-normal" style={{ color: '#627494' }}>FCFA</span>
              </p>
              <div className="h-16">
                <AreaLine data={revenue30d} max={max30d} color="#00D4FF" />
              </div>
              <div className="flex justify-between mt-1">
                {['1 mai', '10', '20', '31 mai'].map((l) => (
                  <span key={l} className="text-xs" style={{ color: '#627494' }}>{l}</span>
                ))}
              </div>
            </div>

            {/* Hourly bars */}
            <div className="col-span-2 rounded-lg p-4 border" style={{ background: '#0D1526', borderColor: '#1E2D45' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold" style={{ color: '#E2EAF4' }}>Revenus 24h</h3>
                <span className="text-xs" style={{ color: '#627494' }}>Aujourd'hui</span>
              </div>
              <div className="flex items-end gap-0.5 h-20">
                {revenueHourly.map((v, i) => (
                  <div key={i} className="flex-1 rounded-sm transition-all"
                    style={{
                      height: `${Math.max(2, (v / maxHourly) * 76)}px`,
                      background: v > maxHourly * 0.7 ? '#00D4FF' : v > maxHourly * 0.4 ? '#7C3AED' : '#1E2D45',
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1">
                {[0, 6, 12, 18, 23].map((h) => (
                  <span key={h} className="text-xs" style={{ color: '#627494' }}>{h}h</span>
                ))}
              </div>
            </div>
          </div>

          {/* Heatmap */}
          <div className="rounded-lg p-4 border" style={{ background: '#0D1526', borderColor: '#1E2D45' }}>
            <h3 className="text-xs font-semibold mb-3" style={{ color: '#E2EAF4' }}>Heatmap sessions — heure × jour</h3>
            <div className="overflow-x-auto">
              <div className="flex gap-1">
                <div className="flex flex-col gap-0.5 mr-1" style={{ marginTop: '16px' }}>
                  {days.map((d) => (
                    <div key={d} className="h-4 flex items-center text-xs" style={{ color: '#627494', minWidth: '28px' }}>{d}</div>
                  ))}
                </div>
                <div>
                  <div className="flex gap-0.5 mb-0.5">
                    {hours.map((h, i) => (
                      <div key={i} className="w-4 text-center" style={{ color: '#627494', fontSize: '9px', minWidth: '16px' }}>{h}</div>
                    ))}
                  </div>
                  {heatmap.map((row, di) => (
                    <div key={di} className="flex gap-0.5 mb-0.5">
                      {row.map((v, hi) => {
                        const intensity = v / heatMax;
                        const bg = intensity > 0.7
                          ? `rgba(0,212,255,${intensity})`
                          : intensity > 0.3
                            ? `rgba(124,58,237,${intensity + 0.2})`
                            : `rgba(30,45,69,${0.6 + intensity})`;
                        return <div key={hi} className="w-4 h-4 rounded-sm" style={{ background: bg, minWidth: '16px' }} title={`${days[di]} ${hi}h: ${v}`} />;
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sessions + routeurs + alertes */}
          <div className="grid grid-cols-3 gap-4">
            {/* Sessions live */}
            <div className="rounded-lg border overflow-hidden" style={{ background: '#0D1526', borderColor: '#1E2D45' }}>
              <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: '#1E2D45' }}>
                <h3 className="text-xs font-semibold" style={{ color: '#E2EAF4' }}>Sessions live</h3>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00D4FF' }} />
                  <span className="text-xs" style={{ color: '#627494' }}>138 actives</span>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid #1E2D45' }}>
                    {['Client', 'Routeur', 'Durée', 'État'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: '#627494' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #1E2D4520' }}>
                      <td className="px-3 py-2 font-medium truncate max-w-[80px]" style={{ color: '#E2EAF4' }}>{s.client}</td>
                      <td className="px-3 py-2" style={{ color: '#627494' }}>{s.router.replace(/^.*?-/, '')}</td>
                      <td className="px-3 py-2 font-mono" style={{ color: '#7C3AED' }}>{s.duration}</td>
                      <td className="px-3 py-2">
                        <span style={{ color: s.status === 'active' ? '#34D399' : '#F59E0B', fontSize: '10px' }}>
                          ● {s.status === 'active' ? 'OK' : 'WARN'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Routeurs état */}
            <div className="rounded-lg border" style={{ background: '#0D1526', borderColor: '#1E2D45' }}>
              <div className="px-4 py-2.5 border-b" style={{ borderColor: '#1E2D45' }}>
                <h3 className="text-xs font-semibold" style={{ color: '#E2EAF4' }}>Routeurs — état</h3>
              </div>
              <div className="p-2 space-y-1.5">
                {routers.map((r) => {
                  const col = r.status === 'online' ? '#34D399' : r.status === 'degraded' ? '#F59E0B' : '#F87171';
                  return (
                    <div key={r.name} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs" style={{ background: '#162035' }}>
                      <span style={{ color: col }}>●</span>
                      <span className="flex-1 truncate font-medium" style={{ color: '#E2EAF4' }}>{r.name}</span>
                      {r.status !== 'offline' ? (
                        <>
                          <div className="flex items-center gap-1">
                            <div className="w-10 h-1.5 rounded-full overflow-hidden" style={{ background: '#1E2D45' }}>
                              <div className="h-full rounded-full" style={{ width: `${r.cpu}%`, background: r.cpu > 75 ? '#F87171' : r.cpu > 50 ? '#F59E0B' : '#34D399' }} />
                            </div>
                            <span style={{ color: '#627494' }}>{r.cpu}%</span>
                          </div>
                          <span className="font-mono w-5 text-right" style={{ color: '#00D4FF' }}>{r.sessions}</span>
                        </>
                      ) : (
                        <span style={{ color: '#627494' }}>offline</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Alertes */}
            <div className="rounded-lg border" style={{ background: '#0D1526', borderColor: '#1E2D45' }}>
              <div className="px-4 py-2.5 border-b" style={{ borderColor: '#1E2D45' }}>
                <h3 className="text-xs font-semibold" style={{ color: '#E2EAF4' }}>Alertes système</h3>
              </div>
              <div className="p-2 space-y-1">
                {alerts.map((a, i) => {
                  const s = alertStyle[a.severity];
                  return (
                    <div key={i} className="flex gap-2 px-2 py-1.5 rounded" style={{ background: '#162035' }}>
                      <span className="font-mono text-xs shrink-0" style={{ color: '#627494' }}>{a.time}</span>
                      <span className="text-xs font-bold shrink-0 w-8" style={{ color: s.color }}>{s.label}</span>
                      <span className="text-xs truncate" style={{ color: '#E2EAF4' }}>{a.message}</span>
                    </div>
                  );
                })}
                {/* État erreur example */}
                <div className="flex gap-2 px-2 py-1.5 rounded border border-red-900/40" style={{ background: '#1a0a0a' }}>
                  <span className="font-mono text-xs shrink-0" style={{ color: '#627494' }}>—</span>
                  <span className="text-xs font-bold shrink-0 w-8" style={{ color: '#F87171' }}>ERR</span>
                  <span className="text-xs" style={{ color: '#F87171' }}>Connexion API Man-01 échouée</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
