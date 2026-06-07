// ─── KPIs ─────────────────────────────────────────────────────────────────────
export const kpis = [
  { label: 'Revenus du jour',   value: '45 200 FCFA', trend: '+12%', up: true },
  { label: 'Sessions actives',  value: '138',         trend: '+5%',  up: true },
  { label: 'Routeurs en ligne', value: '5 / 7',       trend: '-1',   up: false },
  { label: 'Vouchers vendus',   value: '312',         trend: '+8%',  up: true },
  { label: 'Clients du jour',   value: '94',          trend: '+3%',  up: true },
];

// ─── SESSIONS ─────────────────────────────────────────────────────────────────
export const sessions = [
  { id: 'S-001', client: 'Konan Yao',       mac: 'A4:C3:F0:85', router: 'Abidjan-03',       plan: '1h — 200F',    since: '14:23', duration: '1h 12m', data: '124 MB',  status: 'active'   as const },
  { id: 'S-002', client: 'Awa Diallo',      mac: 'DC:A6:32:1F', router: 'Abidjan-01',       plan: '3h — 500F',    since: '13:10', duration: '2h 45m', data: '312 MB',  status: 'active'   as const },
  { id: 'S-003', client: 'Marc Kouassi',    mac: 'B8:27:EB:3D', router: 'Bouaké-01',        plan: '24h — 2000F',  since: '09:45', duration: '5h 10m', data: '1.1 GB',  status: 'active'   as const },
  { id: 'S-004', client: 'Fatou Bamba',     mac: 'E4:5F:01:AB', router: 'Abidjan-01',       plan: '30min — 100F', since: '14:51', duration: '0h 04m', data: '8 MB',    status: 'expiring' as const },
  { id: 'S-005', client: 'Issouf Traoré',   mac: 'F0:18:98:57', router: 'Bouaké-02',        plan: '1h — 200F',    since: '14:02', duration: '0h 53m', data: '78 MB',   status: 'active'   as const },
  { id: 'S-006', client: 'Adjoua Gnamien',  mac: '78:A5:04:D8', router: 'Yamoussoukro-01',  plan: '24h — 2000F',  since: '10:18', duration: '4h 37m', data: '890 MB',  status: 'active'   as const },
];

// ─── ROUTERS ──────────────────────────────────────────────────────────────────
export const routers = [
  { name: 'Abidjan-01',       ip: '10.66.66.2',  sessions: 32, cpu: 45, memory: 62, uptime: '12j 3h',  status: 'online'   as const },
  { name: 'Abidjan-03',       ip: '10.66.66.4',  sessions: 21, cpu: 23, memory: 41, uptime: '8j 19h',  status: 'online'   as const },
  { name: 'Bouaké-01',        ip: '10.66.66.6',  sessions: 18, cpu: 67, memory: 58, uptime: '5j 14h',  status: 'online'   as const },
  { name: 'Bouaké-02',        ip: '10.66.66.7',  sessions: 15, cpu: 34, memory: 47, uptime: '21j 6h',  status: 'online'   as const },
  { name: 'Yamoussoukro-01',  ip: '10.66.66.9',  sessions: 12, cpu: 89, memory: 78, uptime: '2j 8h',   status: 'degraded' as const },
  { name: 'San-Pedro-01',     ip: '10.66.66.11', sessions:  0, cpu:  0, memory:  0, uptime: '—',        status: 'offline'  as const },
  { name: 'Man-01',           ip: '10.66.66.13', sessions:  0, cpu:  0, memory:  0, uptime: '—',        status: 'offline'  as const },
];

// ─── REVENUE ──────────────────────────────────────────────────────────────────
// 24 heures (FCFA)
export const revenueHourly = [
  0, 0, 0, 200, 500, 1200, 3400, 5600, 6800, 7200, 6500, 7800,
  8200, 7600, 6900, 8100, 7400, 6200, 5100, 4300, 3200, 2100, 1200, 600,
];

// 7 jours
export const revenue7d = [
  { day: 'Lun', amount: 38000 },
  { day: 'Mar', amount: 41500 },
  { day: 'Mer', amount: 36800 },
  { day: 'Jeu', amount: 52000 },
  { day: 'Ven', amount: 47300 },
  { day: 'Sam', amount: 61000 },
  { day: 'Dim', amount: 45200 },
];

// 30 jours — valeurs brutes pour graphique area
export const revenue30d = [
  38200, 41500, 35800, 44000, 48300, 52100, 39700,
  42000, 38900, 43500, 51200, 47800, 40100, 55000,
  44700, 39200, 46800, 53400, 48100, 41600, 58900,
  45200, 43800, 47300, 52700, 61000, 55400, 48800,
  43200, 45200,
];

// Objectif journalier
export const dailyGoal = { current: 45200, target: 58000 };

// ─── CLIENTS ──────────────────────────────────────────────────────────────────
export const customers = [
  { id: 'C-001', name: 'Kouassi Amoikon',  mac: 'A4:C3:F0:85', router: 'Abidjan-03',      sessions: 47,  spent: 9400,  lastSeen: 'il y a 5 min',  status: 'active'  as const },
  { id: 'C-002', name: 'Aminata Diabaté',  mac: 'DC:A6:32:1F', router: 'Abidjan-01',      sessions: 128, spent: 25600, lastSeen: 'il y a 10 min', status: 'active'  as const },
  { id: 'C-003', name: 'Ibrahim Coulibaly',mac: 'E4:5F:01:AB', router: 'Bouaké-01',       sessions: 23,  spent: 4600,  lastSeen: 'il y a 2h',     status: 'active'  as const },
  { id: 'C-004', name: 'Fatou Koné',       mac: 'F0:18:98:57', router: 'Yamoussoukro-01', sessions: 89,  spent: 17800, lastSeen: 'hier',           status: 'active'  as const },
  { id: 'C-005', name: 'Yao Brou',         mac: '78:A5:04:D8', router: 'Abidjan-01',      sessions: 312, spent: 62400, lastSeen: 'il y a 1h',     status: 'active'  as const },
  { id: 'C-006', name: 'Mariam Traoré',    mac: '3C:22:FB:7A', router: 'Bouaké-02',       sessions: 15,  spent: 3000,  lastSeen: 'il y a 3j',     status: 'blocked' as const },
];

// ─── VOUCHERS ─────────────────────────────────────────────────────────────────
export const vouchers = [
  { code: 'ADJ-4K7M', plan: '2h — 500F',    router: 'Abidjan-03', status: 'active'    as const, activatedAt: '13:12', expiresAt: '15:12'         },
  { code: 'PLA-8B3N', plan: '24h — 1000F',  router: 'Abidjan-01', status: 'active'    as const, activatedAt: '11:31', expiresAt: 'Demain 11:31'  },
  { code: 'BKE-2F9L', plan: '1h — 200F',    router: null,         status: 'generated' as const, activatedAt: null,    expiresAt: null            },
  { code: 'MAR-7C4D', plan: '7j — 2000F',   router: 'Bouaké-02',  status: 'expired'   as const, activatedAt: '24/05', expiresAt: '31/05'         },
  { code: 'YOP-9A6G', plan: '1h — 200F',    router: null,         status: 'generated' as const, activatedAt: null,    expiresAt: null            },
  { code: 'ADJ-3X7Y', plan: '24h — 1000F',  router: 'Abidjan-03', status: 'revoked'   as const, activatedAt: null,    expiresAt: null            },
  { code: 'BKE-5T2R', plan: '30j — 5000F',  router: 'Bouaké-01',  status: 'active'    as const, activatedAt: '01/05', expiresAt: '31/05'         },
];

// ─── FORFAITS ─────────────────────────────────────────────────────────────────
export const plans = [
  { name: '1 Heure',    price: 200,  duration: '1h',  speed: '4 Mbps',  popular: false },
  { name: '2 Heures',   price: 500,  duration: '2h',  speed: '6 Mbps',  popular: true  },
  { name: '24 Heures',  price: 1000, duration: '24h', speed: '8 Mbps',  popular: true  },
  { name: '7 Jours',    price: 2000, duration: '7j',  speed: '10 Mbps', popular: false },
  { name: '30 Jours',   price: 5000, duration: '30j', speed: '20 Mbps', popular: false },
];

// ─── ALERTES ──────────────────────────────────────────────────────────────────
export const alerts = [
  { time: '14:55', severity: 'warn'  as const, message: 'Yamoussoukro-01 offline depuis 2h'            },
  { time: '14:42', severity: 'info'  as const, message: 'Pic sessions : 138 connectés simultanément'   },
  { time: '14:31', severity: 'warn'  as const, message: 'San-Pedro-01 offline depuis 5h'               },
  { time: '13:58', severity: 'info'  as const, message: 'Objectif 24h : 78% atteint (45 200 FCFA)'     },
  { time: '12:15', severity: 'error' as const, message: 'CPU > 85% — Yamoussoukro-01 en surcharge'     },
];
