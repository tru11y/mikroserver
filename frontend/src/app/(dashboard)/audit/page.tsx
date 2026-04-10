'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import {
  AlertTriangle,
  Clock3,
  FileSearch,
  Filter,
  History,
  Router,
  Search,
  Shield,
  Trash2,
  Wrench,
} from 'lucide-react';
import { clsx } from 'clsx';

interface AuditActor {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuditRouter {
  id: string;
  name: string;
}

interface AuditItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  description: string | null;
  createdAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  actor: AuditActor | null;
  router: AuditRouter | null;
  changeKeys: string[];
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
}

interface AuditResponse {
  summary: {
    total: number;
    today: number;
    create: number;
    update: number;
    delete: number;
    security: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    actions: string[];
    entityTypes: string[];
  };
  items: AuditItem[];
}

const actionStyles: Record<string, string> = {
  CREATE: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  UPDATE: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  DELETE: 'bg-red-500/10 text-red-300 border-red-500/20',
  LOGIN: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  LOGOUT: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  SECURITY_ALERT: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
};

function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatJson(value: Record<string, unknown> | null): string {
  if (!value || Object.keys(value).length === 0) {
    return '{}';
  }

  return JSON.stringify(value, null, 2);
}

export default function AuditPage() {
  const today = useMemo(() => new Date(), []);
  const weekStart = useMemo(
    () => new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000),
    [today],
  );

  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(formatDateInput(weekStart));
  const [endDate, setEndDate] = useState(formatDateInput(today));

  const { data: meData, isLoading: isLoadingMe } = useQuery({
    queryKey: ['audit-me'],
    queryFn: () => api.auth.me(),
  });

  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canViewAudit = hasPermission(currentUser, 'audit.view');

  const filters = {
    page,
    limit,
    action: action || undefined,
    entityType: entityType || undefined,
    search: search || undefined,
    startDate,
    endDate,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, limit, action, entityType, search, startDate, endDate],
    queryFn: () => api.audit.logs(filters),
    enabled: canViewAudit,
  });

  const audit = (data ? unwrap<AuditResponse>(data) : null) as AuditResponse | null;
  const summary = audit?.summary ?? {
    total: 0,
    today: 0,
    create: 0,
    update: 0,
    delete: 0,
    security: 0,
  };
  const pagination = audit?.pagination ?? {
    page: 1,
    limit,
    total: 0,
    totalPages: 1,
  };
  const items = audit?.items ?? [];
  const availableActions = audit?.filters.actions ?? [];
  const availableEntityTypes = audit?.filters.entityTypes ?? [];

  if (isLoadingMe) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!canViewAudit) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <History className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Acces limite</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ton profil ne permet pas de consulter le journal d&apos;audit.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Journal d&apos;audit</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Vue centralisee des actions sensibles, suppressions, changements et connexions admin.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total', value: summary.total, icon: FileSearch },
          { label: "Aujourd'hui", value: summary.today, icon: Clock3 },
          { label: 'Mises a jour', value: summary.update, icon: Wrench },
          { label: 'Suppressions', value: summary.delete, icon: Trash2 },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </p>
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-3 text-3xl font-bold tabular-nums">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Filtres</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1.5 xl:col-span-2">
            <label className="text-sm font-medium">Recherche</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
                placeholder="Description, acteur, routeur, requestId..."
                className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Action</label>
            <select
              value={action}
              onChange={(event) => {
                setPage(1);
                setAction(event.target.value);
              }}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Toutes</option>
              {availableActions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type d&apos;entite</label>
            <select
              value={entityType}
              onChange={(event) => {
                setPage(1);
                setEntityType(event.target.value);
              }}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Tous</option>
              {availableEntityTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Date debut</label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => {
                setPage(1);
                setStartDate(event.target.value);
              }}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Date fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => {
                setPage(1);
                setEndDate(event.target.value);
              }}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold">Evenements traces</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {pagination.total} evenement(s) trouves | page {pagination.page} / {pagination.totalPages}
            </p>
          </div>
          <div className="rounded-full border px-3 py-1 text-xs text-muted-foreground">
            Alertes securite: {summary.security}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aucun evenement ne correspond aux filtres actuels.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <article key={item.id} className="rounded-xl border bg-muted/10 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={clsx(
                          'rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                          actionStyles[item.action] ?? 'bg-slate-500/10 text-slate-300 border-slate-500/20',
                        )}
                      >
                        {item.action}
                      </span>
                      <span className="rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {item.entityType}
                      </span>
                      {item.changeKeys.length > 0 && (
                        <span className="rounded-full border px-2.5 py-0.5 text-[10px] text-muted-foreground">
                          {item.changeKeys.length} champ{item.changeKeys.length !== 1 ? 's' : ''} touche{item.changeKeys.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="font-medium">
                        {item.description ?? `${item.entityType} ${item.entityLabel ?? item.entityId ?? ''}`.trim()}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.entityLabel
                          ? `Entite: ${item.entityLabel}`
                          : item.entityId
                            ? `Entite ID: ${item.entityId}`
                            : 'Entite non resolue'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground lg:text-right">
                    <div>{new Date(item.createdAt).toLocaleString('fr-FR')}</div>
                    {item.actor && (
                      <div className="inline-flex items-center gap-1 lg:justify-end">
                        <Shield className="h-3.5 w-3.5" />
                        {item.actor.name} - {item.actor.role}
                      </div>
                    )}
                    {item.router && (
                      <div className="inline-flex items-center gap-1 lg:justify-end">
                        <Router className="h-3.5 w-3.5" />
                        {item.router.name}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {item.ipAddress && <span>IP: {item.ipAddress}</span>}
                  {item.requestId && <span>Request: {item.requestId}</span>}
                  {item.userAgent && (
                    <span className="truncate max-w-full">UA: {item.userAgent}</span>
                  )}
                </div>

                {(item.oldValues || item.newValues) && (
                  <details className="mt-4 rounded-lg border bg-background/60 p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Voir les details techniques
                    </summary>
                    <div className="mt-3 grid gap-3 xl:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Avant
                        </p>
                        <pre className="overflow-x-auto rounded-lg bg-muted/30 p-3 text-xs">
                          {formatJson(item.oldValues)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Apres
                        </p>
                        <pre className="overflow-x-auto rounded-lg bg-muted/30 p-3 text-xs">
                          {formatJson(item.newValues)}
                        </pre>
                      </div>
                    </div>
                  </details>
                )}
              </article>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {summary.create} creations | {summary.update} mises a jour | {summary.delete} suppressions
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Precedent
            </button>
            <button
              type="button"
              onClick={() =>
                setPage((current) =>
                  current < pagination.totalPages ? current + 1 : current,
                )
              }
              disabled={page >= pagination.totalPages}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Le journal d&apos;audit est une vue d&apos;analyse et de traçabilité. Il n&apos;annule pas les actions déjà appliquées
            au SaaS ni au MikroTik.
          </p>
        </div>
      </div>
    </div>
  );
}
