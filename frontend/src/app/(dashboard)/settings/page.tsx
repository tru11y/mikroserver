'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiError, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';
import {
  Settings,
  User,
  Shield,
  Server,
  CreditCard,
  Wifi,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  RefreshCw,
  Ticket,
  KeyRound,
  Mail,
} from 'lucide-react';
import { clsx } from 'clsx';

interface ConfigEntry {
  value: string;
  description: string;
  isSecret: boolean;
}

type Config = Record<string, ConfigEntry>;

function Section({ icon, color, title, children }: { icon: React.ReactNode; color: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className={clsx('p-2 rounded-lg', color)}>{icon}</div>
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({
  label, description, value, onChange, isSecret, disabled,
}: {
  label: string; description?: string; value: string;
  onChange: (v: string) => void; isSecret?: boolean; disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isMasked = isSecret && value === '••••••••';

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="relative">
        <input
          type={isSecret && !show ? 'password' : 'text'}
          value={value}
          disabled={disabled}
          placeholder={isMasked ? '(inchangé — laisser vide pour garder)' : ''}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 pr-9"
        />
        {isSecret && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border bg-background px-3 py-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="mt-1 h-4 w-4 rounded border-border"
      />
    </label>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const { data: meData } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
  const user = meData ? unwrap<{ firstName?: string; lastName?: string; email?: string; role?: string; lastLoginAt?: string }>(meData) : undefined;

  const { data: configData, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.settings.get(),
  });
  const config = useMemo<Config>(
    () => (configData ? unwrap<Config>(configData) : {}) as Config,
    [configData],
  );

  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!config || Object.keys(config).length === 0) {
      return;
    }

    setForm((current) => {
      if (Object.keys(current).length > 0) {
        return current;
      }

      const initial: Record<string, string> = {};
      for (const [key, entry] of Object.entries(config)) {
        initial[key] = entry.value;
      }
      return initial;
    });
  }, [config]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, string>) => api.settings.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: () => api.auth.updateProfile(newEmail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setNewEmail('');
      setEmailError(null);
      setEmailSuccess('Email mis à jour avec succès.');
      setTimeout(() => setEmailSuccess(null), 4000);
    },
    onError: (error: any) => {
      setEmailSuccess(null);
      setEmailError(
        error?.response?.data?.message ?? 'Impossible de modifier l\'email.',
      );
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: () => api.auth.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError(null);
      setPasswordSuccess('Mot de passe mis a jour avec succes.');
      setTimeout(() => setPasswordSuccess(null), 4000);
    },
    onError: (error: any) => {
      setPasswordSuccess(null);
      setPasswordError(
        error?.response?.data?.message ??
          'Changement de mot de passe impossible.',
      );
    },
  });

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));
  const readBool = (key: string, fallback: boolean) =>
    (form[key] ?? (fallback ? 'true' : 'false')).toLowerCase() === 'true';
  const canEdit = hasPermission(user, 'settings.manage');

  const handleSave = () => {
    if (!canEdit) return;
    updateMutation.mutate(form);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-muted-foreground text-sm mt-1">Configuration complète de la plateforme</p>
          {!canEdit && (
            <p className="text-xs text-amber-500 mt-2">
              Lecture seule. Seul un super administrateur peut modifier ces paramètres.
            </p>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={!canEdit || updateMutation.isPending || isLoading}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            saved
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50',
          )}
        >
          {updateMutation.isPending
            ? <><RefreshCw className="h-4 w-4 animate-spin" />Sauvegarde...</>
            : saved
            ? <><CheckCircle className="h-4 w-4" />Sauvegardé</>
            : <><Save className="h-4 w-4" />Sauvegarder</>
          }
        </button>
      </div>

      {/* Profil */}
      <Section icon={<User className="h-4 w-4" />} color="bg-primary/10 text-primary" title="Profil administrateur">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Nom complet</p>
            <p className="font-medium">{user ? `${user.firstName} ${user.lastName}` : '...'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Email actuel</p>
            <p className="font-medium">{user?.email ?? '...'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Rôle</p>
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium text-primary bg-primary/10 border-primary/20">
              <Shield className="h-3 w-3" />{user?.role ?? '...'}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Dernière connexion</p>
            <p className="text-xs">{user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('fr-FR') : '—'}</p>
          </div>
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-xs text-muted-foreground">Modifier l'adresse email de connexion</p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Field
                label="Nouvel email"
                value={newEmail}
                onChange={setNewEmail}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setEmailError(null);
                setEmailSuccess(null);
                updateEmailMutation.mutate();
              }}
              disabled={updateEmailMutation.isPending || !newEmail.includes('@')}
              className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
            >
              {updateEmailMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Modifier
            </button>
          </div>
          {emailError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{emailError}</p>
          )}
          {emailSuccess && (
            <p className="text-sm text-emerald-300 bg-emerald-500/10 rounded-lg px-3 py-2">{emailSuccess}</p>
          )}
        </div>
      </Section>

      <Section icon={<KeyRound className="h-4 w-4" />} color="bg-emerald-500/10 text-emerald-400" title="Securite du compte">
        <p className="text-xs text-muted-foreground -mt-1">
          Change ton mot de passe directement depuis la plateforme.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Mot de passe actuel"
            value={currentPassword}
            onChange={setCurrentPassword}
            isSecret
          />
          <div />
          <Field
            label="Nouveau mot de passe"
            description="Minimum 12 caracteres"
            value={newPassword}
            onChange={setNewPassword}
            isSecret
          />
          <Field
            label="Confirmer le nouveau mot de passe"
            value={confirmPassword}
            onChange={setConfirmPassword}
            isSecret
          />
        </div>

        {passwordError && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
            {passwordError}
          </p>
        )}
        {passwordSuccess && (
          <p className="text-sm text-emerald-300 bg-emerald-500/10 rounded-lg px-3 py-2">
            {passwordSuccess}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPasswordError(null);
              setPasswordSuccess(null);
              if (newPassword !== confirmPassword) {
                setPasswordError('Les deux nouveaux mots de passe ne correspondent pas.');
                return;
              }
              changePasswordMutation.mutate();
            }}
            disabled={
              changePasswordMutation.isPending ||
              !currentPassword ||
              newPassword.length < 12 ||
              confirmPassword.length < 12
            }
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {changePasswordMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Mise a jour...
              </>
            ) : (
              'Changer mon mot de passe'
            )}
          </button>
          <a
            href="/forgot-password"
            className="inline-flex items-center rounded-lg border px-3 py-2 text-sm hover:bg-muted/50"
          >
            Reset via email + OTP
          </a>
        </div>
      </Section>

      {/* Business */}
      <Section icon={<Settings className="h-4 w-4" />} color="bg-violet-500/10 text-violet-400" title="Informations business">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Nom de la plateforme"
            value={form['business.name'] ?? ''}
            onChange={v => set('business.name', v)}
            disabled={!canEdit}
          />
          <Field
            label="Pays"
            description="Code ISO (CI, SN, ML...)"
            value={form['business.country'] ?? ''}
            onChange={v => set('business.country', v)}
            disabled={!canEdit}
          />
          <div className="col-span-2">
            <Field
              label="Téléphone de contact"
              value={form['business.phone'] ?? ''}
              onChange={v => set('business.phone', v)}
              disabled={!canEdit}
            />
          </div>
        </div>
      </Section>

      {/* Wave */}
      <Section icon={<CreditCard className="h-4 w-4" />} color="bg-emerald-500/10 text-emerald-400" title="Compte Wave CI">
        <p className="text-xs text-muted-foreground -mt-1">
          Configurez votre compte Wave pour accepter les paiements mobile money.
          La clé API se trouve dans votre dashboard Wave → Développeurs.
        </p>
        <div className="grid grid-cols-1 gap-4">
          <Field
            label="Nom du marchand Wave"
            description="Affiché sur la page de paiement Wave"
            value={form['wave.merchant_name'] ?? ''}
            onChange={v => set('wave.merchant_name', v)}
            disabled={!canEdit}
          />
          <Field
            label="Clé API Wave"
            description="Commence par wave_sn_ ou wave_ci_"
            value={form['wave.api_key'] ?? ''}
            onChange={v => set('wave.api_key', v)}
            isSecret
            disabled={!canEdit}
          />
          <Field
            label="Secret webhook Wave"
            description="Pour vérifier la signature HMAC-SHA256 des webhooks"
            value={form['wave.webhook_secret'] ?? ''}
            onChange={v => set('wave.webhook_secret', v)}
            isSecret
            disabled={!canEdit}
          />
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
          <p className="font-medium text-muted-foreground">URL Webhook à configurer dans Wave :</p>
          <code className="font-mono text-primary select-all">
            {typeof window !== 'undefined' ? window.location.origin : 'https://votre-domaine.com'}/proxy/api/v1/webhooks/wave
          </code>
        </div>
      </Section>

      {/* Hotspot defaults */}
      <Section icon={<Wifi className="h-4 w-4" />} color="bg-amber-500/10 text-amber-400" title="Paramètres Hotspot par défaut">
        <p className="text-xs text-muted-foreground -mt-1">
          Ces valeurs sont pré-remplies lors de l'ajout d'un nouveau routeur.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Profil hotspot par défaut"
            description="Nom du profil RouterOS"
            value={form['hotspot.default_profile'] ?? ''}
            onChange={v => set('hotspot.default_profile', v)}
            disabled={!canEdit}
          />
          <Field
            label="Serveur hotspot par défaut"
            description="Nom du serveur RouterOS"
            value={form['hotspot.default_server'] ?? ''}
            onChange={v => set('hotspot.default_server', v)}
            disabled={!canEdit}
          />
        </div>
      </Section>

      <Section icon={<Ticket className="h-4 w-4" />} color="bg-rose-500/10 text-rose-400" title="Réglages ticket et impression">
        <p className="text-xs text-muted-foreground -mt-1">
          Ces options pilotent l'affichage des tickets dans le SaaS et dans les PDF générés.
          Elles ne modifient pas la page hotspot locale du routeur.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <ToggleField
            label="Afficher le nom entreprise"
            description="Nom commercial imprimé en haut du ticket"
            checked={readBool('ticket.show_enterprise_name', true)}
            onChange={(checked) => set('ticket.show_enterprise_name', String(checked))}
            disabled={!canEdit}
          />
          <Field
            label="Nom entreprise"
            value={form['ticket.enterprise_name'] ?? ''}
            onChange={(value) => set('ticket.enterprise_name', value)}
            disabled={!canEdit}
          />

          <ToggleField
            label="Afficher le nom WiFi"
            description="SSID imprimé sur le ticket"
            checked={readBool('ticket.show_wifi_name', true)}
            onChange={(checked) => set('ticket.show_wifi_name', String(checked))}
            disabled={!canEdit}
          />
          <Field
            label="Nom WIFI-SSID"
            value={form['ticket.wifi_ssid'] ?? ''}
            onChange={(value) => set('ticket.wifi_ssid', value)}
            disabled={!canEdit}
          />

          <ToggleField
            label="Afficher le prix"
            description="Montant imprimé sur le ticket"
            checked={readBool('ticket.show_price', true)}
            onChange={(checked) => set('ticket.show_price', String(checked))}
            disabled={!canEdit}
          />
          <Field
            label="Symbole devise"
            value={form['ticket.currency_symbol'] ?? ''}
            onChange={(value) => set('ticket.currency_symbol', value)}
            disabled={!canEdit}
          />

          <ToggleField
            label="Afficher le numero du ticket"
            description="Numero court #1, #2, #3..."
            checked={readBool('ticket.show_ticket_number', true)}
            onChange={(checked) => set('ticket.show_ticket_number', String(checked))}
            disabled={!canEdit}
          />
          <ToggleField
            label="Afficher le QR code"
            description="Optionnel. Desactive-le pour imprimer un lot compact jusqu'a 50 tickets par feuille."
            checked={readBool('ticket.show_qr_code', false)}
            onChange={(checked) => set('ticket.show_qr_code', String(checked))}
            disabled={!canEdit}
          />
          <Field
            label="Tickets par feuille PDF"
            description="Format compact sans QR. Utilise 50 pour les lots terrain."
            value={form['ticket.pdf_tickets_per_page'] ?? '50'}
            onChange={(value) => set('ticket.pdf_tickets_per_page', value)}
            disabled={!canEdit}
          />

          <ToggleField
            label="Afficher le nom du forfait"
            description="Ex: 1 jour, 1 semaine, 30 minutes"
            checked={readBool('ticket.show_plan_name', true)}
            onChange={(checked) => set('ticket.show_plan_name', String(checked))}
            disabled={!canEdit}
          />
          <ToggleField
            label="Afficher la date de création"
            description="Pratique pour l'audit terrain ou les lots"
            checked={readBool('ticket.show_created_at', false)}
            onChange={(checked) => set('ticket.show_created_at', String(checked))}
            disabled={!canEdit}
          />

          <ToggleField
            label="Afficher le DNS"
            description="Nom DNS / portail d'accès imprimé"
            checked={readBool('ticket.show_dns_name', false)}
            onChange={(checked) => set('ticket.show_dns_name', String(checked))}
            disabled={!canEdit}
          />
          <Field
            label="Nom DNS"
            value={form['ticket.dns_name'] ?? ''}
            onChange={(value) => set('ticket.dns_name', value)}
            disabled={!canEdit}
          />

          <ToggleField
            label="Rappel: garder le ticket"
            description="Message terrain pour le client pendant la session"
            checked={readBool('ticket.keep_ticket_notice', true)}
            onChange={(checked) => set('ticket.keep_ticket_notice', String(checked))}
            disabled={!canEdit}
          />
          <ToggleField
            label="Afficher le logo"
            description="Logo distant utilisé sur le PDF ticket"
            checked={readBool('ticket.show_logo', false)}
            onChange={(checked) => set('ticket.show_logo', String(checked))}
            disabled={!canEdit}
          />

          <div className="md:col-span-2">
            <Field
              label="URL du logo"
              description="Image publique PNG ou JPG"
              value={form['ticket.logo_url'] ?? ''}
              onChange={(value) => set('ticket.logo_url', value)}
              disabled={!canEdit}
            />
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          Aperçu rapide actuel :
          {` entreprise=${readBool('ticket.show_enterprise_name', true) ? 'oui' : 'non'},`}
          {` wifi=${readBool('ticket.show_wifi_name', true) ? 'oui' : 'non'},`}
          {` prix=${readBool('ticket.show_price', true) ? 'oui' : 'non'},`}
          {` qr=${readBool('ticket.show_qr_code', false) ? 'oui' : 'non'},`}
          {` pdf=${form['ticket.pdf_tickets_per_page'] ?? '50'} tickets/feuille.`}
        </div>
      </Section>

      {/* WireGuard info */}
      <Section icon={<Server className="h-4 w-4" />} color="bg-blue-500/10 text-blue-400" title="Infrastructure WireGuard">
        <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-muted-foreground">Serveur VPS :</span> <span className="font-mono">10.66.66.1</span></div>
            <div><span className="text-muted-foreground">Plage routeurs :</span> <span className="font-mono">10.66.66.2+</span></div>
            <div><span className="text-muted-foreground">Port API RouterOS :</span> <span className="font-mono">8728</span></div>
            <div><span className="text-muted-foreground">Protocole :</span> <span className="font-mono">WireGuard UDP</span></div>
          </div>
          <p className="text-muted-foreground pt-2 border-t border-border mt-2">
            Chaque routeur MikroTik doit être connecté via WireGuard et avoir l'API RouterOS activée sur le port 8728.
          </p>
        </div>
      </Section>

      {/* Email notifications */}
      <Section icon={<Mail className="h-4 w-4" />} color="bg-sky-500/10 text-sky-400" title="Notifications email">
        <p className="text-xs text-muted-foreground -mt-1">
          MikroServer envoie des alertes email pour les événements critiques : routeur hors ligne, abonnement expirant, résumé journalier.
        </p>
        <div className="rounded-lg bg-muted/50 p-4 space-y-3 text-xs">
          <p className="font-medium text-foreground">Configuration via variables d&apos;environnement (serveur)</p>
          <div className="grid grid-cols-1 gap-1.5 font-mono">
            <div className="flex items-start gap-2">
              <span className="text-sky-400 shrink-0">SMTP_HOST</span>
              <span className="text-muted-foreground">— Hôte SMTP (ex: smtp.gmail.com, smtp.sendgrid.net)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sky-400 shrink-0">SMTP_PORT</span>
              <span className="text-muted-foreground">— Port SMTP (587 TLS / 465 SSL, défaut: 587)</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sky-400 shrink-0">SMTP_USER</span>
              <span className="text-muted-foreground">— Adresse email d&apos;envoi</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sky-400 shrink-0">SMTP_PASS</span>
              <span className="text-muted-foreground">— Mot de passe SMTP ou App Password</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-sky-400 shrink-0">SMTP_FROM</span>
              <span className="text-muted-foreground">— Expéditeur affiché (défaut: MikroServer &lt;noreply@mikroserver.app&gt;)</span>
            </div>
          </div>
          <div className="border-t border-border pt-3 space-y-1">
            <p className="font-medium text-foreground">Alertes envoyées automatiquement</p>
            <ul className="space-y-1 text-muted-foreground list-disc list-inside">
              <li>Routeur hors ligne — email immédiat au propriétaire du routeur</li>
              <li>Abonnement expirant — alerte à J-7 avant expiration</li>
              <li>Résumé journalier — envoyé chaque jour à 7h00 à tous les administrateurs</li>
            </ul>
          </div>
          <p className="text-amber-400 border-t border-border pt-2">
            Si SMTP_HOST n&apos;est pas défini, les notifications email sont silencieusement désactivées sans bloquer la plateforme.
          </p>
        </div>
      </Section>

      {updateMutation.isError && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          Erreur : {apiError(updateMutation.error, 'Impossible de sauvegarder')}
        </p>
      )}
    </div>
  );
}
