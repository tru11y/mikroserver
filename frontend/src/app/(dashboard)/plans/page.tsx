'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiError, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Clock,
  Copy,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Star,
  Tag,
  Ticket,
  Trash2,
  Wifi,
} from 'lucide-react';
import { clsx } from 'clsx';

type TicketType = 'PIN' | 'USER_PASSWORD';
type DurationMode = 'ELAPSED' | 'PAUSED';

interface PlanTicketSettings {
  ticketType: TicketType;
  durationMode: DurationMode;
  ticketPrefix: string;
  ticketCodeLength: number;
  ticketNumericOnly: boolean;
  ticketPasswordLength: number;
  ticketPasswordNumericOnly: boolean;
  usersPerTicket: number;
}

interface Plan {
  id: string;
  name: string;
  description?: string | null;
  slug: string;
  priceXof: number;
  durationMinutes: number;
  downloadKbps?: number | null;
  uploadKbps?: number | null;
  dataLimitMb?: number | null;
  userProfile?: string | null;
  displayOrder?: number | null;
  isPopular?: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  ticketSettings: PlanTicketSettings;
}

interface CreatePlanForm {
  name: string;
  description: string;
  priceXof: number;
  durationMinutes: number;
  downloadKbps: number;
  uploadKbps: number;
  dataLimitMb: number;
  userProfile: string;
  displayOrder: number;
  isPopular: boolean;
  ticketType: TicketType;
  durationMode: DurationMode;
  ticketPrefix: string;
  ticketCodeLength: number;
  ticketNumericOnly: boolean;
  ticketPasswordLength: number;
  ticketPasswordNumericOnly: boolean;
  usersPerTicket: number;
}

/**
 * Parse RouterOS/WinBox-style duration.
 * Accepted: "3d 00:00:00", "7h 00:00:00", "1d 12:00:00", "0:30:00", "7h", "3d"
 */
function parseDurationInput(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;

  // Nd[ HH:MM[:SS]]
  const dayMatch = s.match(/^(\d+)d(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?$/i);
  if (dayMatch) {
    const d = parseInt(dayMatch[1], 10);
    const h = parseInt(dayMatch[2] ?? '0', 10);
    const m = parseInt(dayMatch[3] ?? '0', 10);
    return d * 24 * 60 + h * 60 + m;
  }

  // Nh[ MM[:SS]] or Nh HH:MM:SS (treat HH as MM in h-context)
  const hourMatch = s.match(/^(\d+)h(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?$/i);
  if (hourMatch) {
    const h = parseInt(hourMatch[1], 10);
    const m = parseInt(hourMatch[2] ?? '0', 10);
    return h * 60 + m;
  }

  // H:MM[:SS] or HH:MM:SS
  const timeMatch = s.match(/^(\d+):(\d{2})(?::\d{2})?$/);
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2], 10);
    return h * 60 + m;
  }

  return null;
}

function pad2(n: number) { return String(n).padStart(2, '0'); }

/** Display in WinBox style: "7h 00:00:00" / "3d 00:00:00" / "0:30:00" */
function formatDurationDisplay(minutes: number): string {
  if (minutes < 60) return `0:${pad2(minutes)}:00`;
  const totalHours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (totalHours < 24) return `${totalHours}h ${pad2(mins)}:00`;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return `${days}d ${pad2(hours)}:${pad2(mins)}:00`;
}

function buildDefaultForm(): CreatePlanForm {
  return {
    name: '',
    description: '',
    priceXof: 500,
    durationMinutes: 60,
    downloadKbps: 2048,
    uploadKbps: 1024,
    dataLimitMb: 0,
    userProfile: 'default',
    displayOrder: 0,
    isPopular: false,
    ticketType: 'PIN',
    durationMode: 'ELAPSED',
    ticketPrefix: 'MS',
    ticketCodeLength: 8,
    ticketNumericOnly: false,
    ticketPasswordLength: 8,
    ticketPasswordNumericOnly: false,
    usersPerTicket: 1,
  };
}


function kbpsToMbps(kbps: number): number {
  if (!kbps) return 0;
  return Number((kbps / 1024).toFixed(kbps % 1024 === 0 ? 0 : 2));
}

function mbpsToKbps(mbps: number): number {
  if (!mbps) return 0;
  return Math.max(64, Math.round(mbps * 1024));
}

function formatDuration(minutes: number): string {
  const hours = minutes / 60;
  if (hours < 24) {
    return `${Number(hours.toFixed(hours % 1 === 0 ? 0 : 1))} h`;
  }
  const days = hours / 24;
  if (days % 1 === 0) {
    return `${days} j (${hours} h)`;
  }
  return `${Number(days.toFixed(1))} j`;
}

function formatSpeed(kbps?: number | null): string {
  if (!kbps) return 'Illimite';
  return `${Number((kbps / 1024).toFixed(kbps % 1024 === 0 ? 0 : 1))} Mbps`;
}

function normalizePlanPayload(form: CreatePlanForm) {
  return {
    name: form.name,
    description: form.description || undefined,
    priceXof: form.priceXof,
    durationMinutes: form.durationMinutes,
    downloadKbps: form.downloadKbps > 0 ? form.downloadKbps : null,
    uploadKbps: form.uploadKbps > 0 ? form.uploadKbps : null,
    dataLimitMb: form.dataLimitMb > 0 ? form.dataLimitMb : null,
    userProfile: form.userProfile || undefined,
    displayOrder: form.displayOrder,
    isPopular: form.isPopular,
    ticketType: form.ticketType,
    durationMode: form.durationMode,
    ticketPrefix: form.ticketPrefix || undefined,
    ticketCodeLength: form.ticketCodeLength,
    ticketNumericOnly: form.ticketNumericOnly,
    ticketPasswordLength: form.ticketPasswordLength,
    ticketPasswordNumericOnly: form.ticketPasswordNumericOnly,
    usersPerTicket: form.usersPerTicket,
  };
}

function describeTicketSettings(settings: PlanTicketSettings): string {
  const ticketType =
    settings.ticketType === 'PIN' ? 'PIN unique' : 'User / Password';
  const durationMode =
    settings.durationMode === 'PAUSED' ? 'temps pause' : 'temps ecoule';
  const prefix = settings.ticketPrefix || 'sans prefixe';
  const password =
    settings.ticketType === 'PIN'
      ? 'meme code = mot de passe'
      : `${settings.ticketPasswordLength} car. mot de passe`;

  return `${ticketType} - ${durationMode} - ${prefix} - ${settings.ticketCodeLength} car. - ${password}`;
}

function PlanFormFields(props: {
  form: CreatePlanForm;
  setForm: Dispatch<SetStateAction<CreatePlanForm>>;
}) {
  const { form, setForm } = props;

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Base
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Prix, duree, debit et profil hotspot du forfait.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">Nom du forfait *</label>
            <input
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="ex: 1 jour - 300 FCFA"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">Description</label>
            <input
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Description courte terrain"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Prix (FCFA) *</label>
            <input
              type="number"
              min={0}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.priceXof}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  priceXof: parseInt(event.target.value, 10) || 0,
                }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Durée *</label>
            <input
              type="text"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              defaultValue={formatDurationDisplay(form.durationMinutes)}
              key={form.durationMinutes}
              placeholder="ex: 7h 00:00:00, 3d 00:00:00, 0:30:00"
              onBlur={(event) => {
                const parsed = parseDurationInput(event.target.value);
                if (parsed !== null) {
                  setForm((current) => ({ ...current, durationMinutes: parsed }));
                  event.target.value = formatDurationDisplay(parsed);
                } else {
                  event.target.value = formatDurationDisplay(form.durationMinutes);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Style WinBox — ex: <code>7h 00:00:00</code> · <code>3d 00:00:00</code> · <code>30d 00:00:00</code> · <code>0:30:00</code>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Download (Mbps)</label>
            <input
              type="number"
              min={0}
              step={0.5}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={kbpsToMbps(form.downloadKbps)}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  downloadKbps: mbpsToKbps(parseFloat(event.target.value) || 0),
                }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Upload (Mbps)</label>
            <input
              type="number"
              min={0}
              step={0.5}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={kbpsToMbps(form.uploadKbps)}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  uploadKbps: mbpsToKbps(parseFloat(event.target.value) || 0),
                }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Quota data (MB)</label>
            <input
              type="number"
              min={0}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.dataLimitMb}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  dataLimitMb: parseInt(event.target.value, 10) || 0,
                }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Profil hotspot</label>
            <input
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.userProfile}
              onChange={(event) =>
                setForm((current) => ({ ...current, userProfile: event.target.value }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Ordre d'affichage</label>
            <input
              type="number"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.displayOrder}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  displayOrder: parseInt(event.target.value, 10) || 0,
                }))
              }
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium pt-8">
            <input
              type="checkbox"
              checked={form.isPopular}
              onChange={(event) =>
                setForm((current) => ({ ...current, isPopular: event.target.checked }))
              }
              className="h-4 w-4 rounded border-border"
            />
            Forfait populaire
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-muted/20 p-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Ticketing
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Reglages type MikroTicket: PIN ou user/password, prefixe, longueur,
            numerique seulement, duree ecoulee ou pausee.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type de ticket</label>
            <select
              value={form.ticketType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  ticketType: event.target.value as TicketType,
                }))
              }
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="PIN">PIN (meme code et mot de passe)</option>
              <option value="USER_PASSWORD">User / Password</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mode de duree</label>
            <select
              value={form.durationMode}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  durationMode: event.target.value as DurationMode,
                }))
              }
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ELAPSED">Temps ecoule</option>
              <option value="PAUSED">Temps pause</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Prefixe ticket</label>
            <input
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="MS ou 1m"
              value={form.ticketPrefix}
              onChange={(event) =>
                setForm((current) => ({ ...current, ticketPrefix: event.target.value }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Longueur code</label>
            <select
              value={form.ticketCodeLength}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  ticketCodeLength: parseInt(event.target.value, 10),
                }))
              }
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {[4, 5, 6, 7, 8, 10, 12, 16].map((length) => (
                <option key={length} value={length}>
                  {length} caracteres
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Utilisateurs par ticket</label>
            <input
              type="number"
              min={1}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.usersPerTicket}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  usersPerTicket: Math.max(1, parseInt(event.target.value, 10) || 1),
                }))
              }
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium pt-8">
            <input
              type="checkbox"
              checked={form.ticketNumericOnly}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  ticketNumericOnly: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-border"
            />
            Code numerique uniquement
          </label>
        </div>

        {form.ticketType === 'USER_PASSWORD' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Longueur mot de passe</label>
              <select
                value={form.ticketPasswordLength}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ticketPasswordLength: parseInt(event.target.value, 10),
                  }))
                }
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {[4, 5, 6, 7, 8, 10, 12, 16].map((length) => (
                  <option key={length} value={length}>
                    {length} caracteres
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium pt-8">
              <input
                type="checkbox"
                checked={form.ticketPasswordNumericOnly}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ticketPasswordNumericOnly: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-border"
              />
              Mot de passe numerique uniquement
            </label>
          </div>
        )}
      </section>
    </div>
  );
}

export default function PlansPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDeletePlanId, setConfirmDeletePlanId] = useState<string | null>(null);
  const [form, setForm] = useState<CreatePlanForm>(buildDefaultForm());

  const { data: meData, isLoading: isMeLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canViewPlans = hasPermission(currentUser, 'plans.view');
  const canManagePlans = hasPermission(currentUser, 'plans.manage');

  const { data, isLoading } = useQuery({
    queryKey: ['plans', showArchived],
    queryFn: () => api.plans.list(showArchived),
    enabled: canViewPlans,
  });

  const plans: Plan[] = data ? (unwrap<Plan[]>(data) ?? (data as { data?: Plan[] })?.data ?? []) : [];

  const resetForm = () => setForm(buildDefaultForm());

  const createMutation = useMutation({
    mutationFn: (payload: CreatePlanForm) =>
      api.plans.create(normalizePlanPayload(payload)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
      setShowForm(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreatePlanForm }) =>
      api.plans.update(id, normalizePlanPayload(data)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
      setEditingPlan(null);
      resetForm();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.plans.archive(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
      setConfirmDeletePlanId(null);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.plans.restore(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (plan: Plan) => {
      const payload = normalizePlanPayload({
        name: `${plan.name} (copie)`,
        description: plan.description ?? '',
        priceXof: plan.priceXof,
        durationMinutes: plan.durationMinutes,
        downloadKbps: plan.downloadKbps ?? 0,
        uploadKbps: plan.uploadKbps ?? 0,
        dataLimitMb: plan.dataLimitMb ?? 0,
        userProfile: plan.userProfile ?? 'default',
        displayOrder: plan.displayOrder ?? 0,
        isPopular: false,
        ticketType: plan.ticketSettings.ticketType,
        durationMode: plan.ticketSettings.durationMode,
        ticketPrefix: plan.ticketSettings.ticketPrefix,
        ticketCodeLength: plan.ticketSettings.ticketCodeLength,
        ticketNumericOnly: plan.ticketSettings.ticketNumericOnly,
        ticketPasswordLength: plan.ticketSettings.ticketPasswordLength,
        ticketPasswordNumericOnly: plan.ticketSettings.ticketPasswordNumericOnly,
        usersPerTicket: plan.ticketSettings.usersPerTicket,
      });
      return api.plans.create(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
    onError: () => {},
  });

  const openEdit = (plan: Plan) => {
    if (!canManagePlans) {
      return;
    }

    setEditingPlan(plan);
    setForm({
      name: plan.name,
      description: plan.description ?? '',
      priceXof: plan.priceXof,
      durationMinutes: plan.durationMinutes,
      downloadKbps: plan.downloadKbps ?? 0,
      uploadKbps: plan.uploadKbps ?? 0,
      dataLimitMb: plan.dataLimitMb ?? 0,
      userProfile: plan.userProfile ?? 'default',
      displayOrder: plan.displayOrder ?? 0,
      isPopular: Boolean(plan.isPopular),
      ticketType: plan.ticketSettings.ticketType,
      durationMode: plan.ticketSettings.durationMode,
      ticketPrefix: plan.ticketSettings.ticketPrefix,
      ticketCodeLength: plan.ticketSettings.ticketCodeLength,
      ticketNumericOnly: plan.ticketSettings.ticketNumericOnly,
      ticketPasswordLength: plan.ticketSettings.ticketPasswordLength,
      ticketPasswordNumericOnly: plan.ticketSettings.ticketPasswordNumericOnly,
      usersPerTicket: plan.ticketSettings.usersPerTicket,
    });
  };

  const closeModal = () => {
    setShowForm(false);
    setEditingPlan(null);
    resetForm();
  };

  if (isMeLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!canViewPlans) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <Tag className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">Acces limite</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ton profil ne permet pas de consulter les forfaits.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Forfaits</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {plans.length} forfait{plans.length !== 1 ? 's' : ''} configure
            {plans.length !== 1 ? 's' : ''} avec regles ticketing avancees.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Voir archives
          </label>

          {canManagePlans && (
            <button
              onClick={() => {
                resetForm();
                setEditingPlan(null);
                setShowForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" />
              Nouveau forfait
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-medium">Aucun forfait configure</p>
          <p className="text-muted-foreground text-sm mt-1">
            Cree des forfaits WiFi avec leur logique ticketing terrain.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-xl border bg-card p-5 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <div className="relative space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {plan.slug}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {plan.isPopular && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                        <Star className="h-3 w-3" />
                        Populaire
                      </span>
                    )}
                    <span
                      className={clsx(
                        'text-xs px-2 py-0.5 rounded-full border font-medium',
                        plan.status === 'ACTIVE'
                          ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                          : 'text-muted-foreground bg-muted border-border',
                      )}
                    >
                      {plan.status === 'ACTIVE' ? 'Actif' : 'Archive'}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-3xl font-bold tabular-nums">
                    {plan.priceXof.toLocaleString('fr-FR')}
                    <span className="text-base font-medium text-muted-foreground ml-1">
                      FCFA
                    </span>
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatDuration(plan.durationMinutes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Wifi className="h-3 w-3" /> ↓{formatSpeed(plan.downloadKbps)} ↑{formatSpeed(plan.uploadKbps)}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/20 p-3 space-y-1.5">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Ticketing
                  </p>
                  <p className="text-sm">{describeTicketSettings(plan.ticketSettings)}</p>
                  <p className="text-xs text-muted-foreground">
                    Profil: {plan.userProfile ?? 'default'} - Quota:{' '}
                    {plan.dataLimitMb ? `${plan.dataLimitMb} MB` : 'Illimite'}
                  </p>
                </div>

                {canManagePlans && (
                  <div className="flex items-center gap-3 flex-wrap">
                    {plan.status === 'ACTIVE' && (
                      <button
                        onClick={() => openEdit(plan)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                        Modifier
                      </button>
                    )}

                    <button
                      onClick={() => duplicateMutation.mutate(plan)}
                      disabled={duplicateMutation.isPending}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      <Copy className="h-3 w-3" />
                      Dupliquer
                    </button>

                    {plan.status === 'ACTIVE' && (
                      <button
                        onClick={() => setConfirmDeletePlanId(plan.id)}
                        disabled={archiveMutation.isPending}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        Supprimer
                      </button>
                    )}

                    {plan.status === 'ARCHIVED' && (
                      <button
                        onClick={() => restoreMutation.mutate(plan.id)}
                        disabled={restoreMutation.isPending}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-emerald-400 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Désarchiver
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDeletePlanId !== null}
        title="Supprimer ce forfait ?"
        description="Le forfait sera archivé et retiré de la liste active. Il restera visible dans les archives et pourra être restauré."
        confirmLabel="Supprimer"
        isLoading={archiveMutation.isPending}
        onConfirm={() => {
          if (confirmDeletePlanId) archiveMutation.mutate(confirmDeletePlanId);
        }}
        onCancel={() => setConfirmDeletePlanId(null)}
      />

      {canManagePlans && (showForm || editingPlan) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl rounded-2xl border bg-card shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div>
              <h2 className="text-lg font-bold">
                {editingPlan ? 'Modifier le forfait' : 'Nouveau forfait'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {editingPlan
                  ? editingPlan.slug
                  : 'Configure prix, vitesse et comportement ticket comme sur le terrain.'}
              </p>
            </div>

            <PlanFormFields form={form} setForm={setForm} />

            {(createMutation.isError || updateMutation.isError) && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {(apiError(createMutation.error, '') ||
                  apiError(updateMutation.error, 'Erreur lors de la sauvegarde'))}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg border text-sm hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (editingPlan) {
                    updateMutation.mutate({ id: editingPlan.id, data: form });
                    return;
                  }
                  createMutation.mutate(form);
                }}
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  !form.name ||
                  form.priceXof <= 0 ||
                  form.durationMinutes <= 0
                }
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                )}
                {editingPlan ? 'Enregistrer' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
