'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Search,
  ChevronDown,
  Copy,
  Check,
  KeyRound,
  UserX,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { usersApi, AdminUser, PaginatedUsersResponse } from '@/lib/api/users';
import { unwrap, apiError } from '@/lib/api/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// ── helpers ────────────────────────────────────────────────────────────────

type UserRole = AdminUser['role'];
type UserStatus = AdminUser['status'];

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  RESELLER: 'Revendeur',
  VIEWER: 'Lecteur',
};

const ROLE_BADGE: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  ADMIN: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  RESELLER: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  VIEWER: 'bg-gray-500/15 text-gray-400 border border-gray-500/30',
};

const ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'RESELLER', 'VIEWER'];

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function StatusDot({ status }: { status: UserStatus }) {
  const active = status === 'ACTIVE';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={`h-2 w-2 rounded-full flex-shrink-0 ${active ? 'bg-green-500' : 'bg-red-500'}`}
      />
      <span className={active ? 'text-green-400' : 'text-red-400'}>
        {active ? 'Actif' : status === 'SUSPENDED' ? 'Suspendu' : 'En attente'}
      </span>
    </span>
  );
}

function AvatarInitials({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  return (
    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-primary">{initials}</span>
    </div>
  );
}

// ── Reset password modal ────────────────────────────────────────────────────

interface ResetModalProps {
  user: AdminUser;
  onClose: () => void;
}

function ResetPasswordModal({ user, onClose }: ResetModalProps) {
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await usersApi.resetPasswordGenerate(user.id);
      const pw = (res.data as unknown as { data: { tempPassword: string } }).data.tempPassword;
      setTempPassword(pw);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!tempPassword) return;
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <KeyRound className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className="font-semibold text-base">Réinitialiser le mot de passe</h2>
            <p className="text-xs text-muted-foreground">{user.firstName} {user.lastName} — {user.email}</p>
          </div>
        </div>

        {!tempPassword ? (
          <>
            <p className="text-sm text-muted-foreground">
              Un mot de passe temporaire sera généré automatiquement. Il devra être communiqué à l'utilisateur
              <span className="font-medium text-foreground"> hors de cette interface</span>.
            </p>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-300">
                Ce mot de passe ne sera affiché qu'une seule fois. Toutes les sessions actives
                de l'utilisateur seront révoquées.
              </p>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Génération...' : 'Générer le mot de passe'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3">
              <p className="text-xs text-green-400 font-medium mb-2">Mot de passe généré :</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-sm bg-background border rounded-lg px-3 py-2 select-all">
                  {tempPassword}
                </code>
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-lg border hover:bg-muted transition-colors flex-shrink-0"
                  title="Copier"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-300">
                Ce mot de passe ne sera plus jamais affiché. Communiquez-le à l'utilisateur maintenant.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
              >
                Fermer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function UsersPage() {
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  // inline role editing: id → selected role
  const [editingRole, setEditingRole] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['users-admin', page, search, roleFilter],
    queryFn: async () => {
      const res = await usersApi.listPaginated({
        page,
        limit: 20,
        search: search || undefined,
        role: roleFilter || undefined,
      });
      return (res.data as unknown as { data: PaginatedUsersResponse }).data;
    },
    placeholderData: (prev) => prev,
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => usersApi.suspend(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users-admin'] }),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => usersApi.activate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users-admin'] }),
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      usersApi.changeRole(id, role),
    onSuccess: (_data, { id }) => {
      setEditingRole((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      qc.invalidateQueries({ queryKey: ['users-admin'] });
    },
  });

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" /> Gestion des utilisateurs
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comptes administrateurs, revendeurs et lecteurs de la plateforme
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Rechercher par nom, email..."
            className="w-full rounded-lg border bg-background pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="relative">
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="appearance-none rounded-lg border bg-background pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Tous les rôles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Stats bar */}
      {data && (
        <p className="text-xs text-muted-foreground">
          {data.total} utilisateur{data.total > 1 ? 's' : ''} trouvé{data.total > 1 ? 's' : ''}
          {search ? ` pour "${search}"` : ''}
          {roleFilter ? ` · filtre : ${ROLE_LABELS[roleFilter as UserRole]}` : ''}
        </p>
      )}

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Utilisateur</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rôle</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Statut</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Routeurs / Vouchers</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Créé le</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-muted-foreground">
                  Chargement...
                </td>
              </tr>
            )}
            {!isLoading && !data?.items?.length && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-muted-foreground">
                  Aucun utilisateur trouvé
                </td>
              </tr>
            )}
            {data?.items?.map((u) => {
              const isSuperAdmin = u.role === 'SUPER_ADMIN';
              const isSuspended = u.status === 'SUSPENDED';
              const pendingRole = editingRole[u.id];

              return (
                <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                  {/* Avatar + name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <AvatarInitials firstName={u.firstName} lastName={u.lastName} />
                      <div>
                        <p className="font-medium text-sm">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>

                  {/* Role: inline select for non-super-admins */}
                  <td className="px-4 py-3">
                    {isSuperAdmin ? (
                      <RoleBadge role={u.role} />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <select
                            value={pendingRole ?? u.role}
                            onChange={(e) =>
                              setEditingRole((prev) => ({ ...prev, [u.id]: e.target.value }))
                            }
                            className="appearance-none rounded-lg border bg-background pl-2 pr-6 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            {ROLES.filter((r) => r !== 'SUPER_ADMIN').map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        </div>
                        {pendingRole && pendingRole !== u.role && (
                          <button
                            onClick={() =>
                              changeRoleMutation.mutate({ id: u.id, role: pendingRole })
                            }
                            disabled={changeRoleMutation.isPending}
                            className="text-xs px-2 py-1 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                          >
                            Sauvegarder
                          </button>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <StatusDot status={u.status} />
                  </td>

                  {/* Counts */}
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                    {u._counts
                      ? `${u._counts.routers} routeur${u._counts.routers !== 1 ? 's' : ''} · ${u._counts.vouchers} voucher${u._counts.vouchers !== 1 ? 's' : ''}`
                      : '—'}
                  </td>

                  {/* Created */}
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">
                    {format(new Date(u.createdAt), 'dd MMM yyyy', { locale: fr })}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Suspend / Activate */}
                      {!isSuperAdmin && (
                        <button
                          onClick={() =>
                            isSuspended
                              ? activateMutation.mutate(u.id)
                              : suspendMutation.mutate(u.id)
                          }
                          disabled={suspendMutation.isPending || activateMutation.isPending}
                          title={isSuspended ? 'Réactiver' : 'Suspendre'}
                          className={`p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50 ${
                            isSuspended ? 'text-green-400' : 'text-amber-400'
                          }`}
                        >
                          {isSuspended ? (
                            <UserCheck className="h-4 w-4" />
                          ) : (
                            <UserX className="h-4 w-4" />
                          )}
                        </button>
                      )}

                      {/* Reset password */}
                      {!isSuperAdmin && (
                        <button
                          onClick={() => setResetTarget(u)}
                          title="Réinitialiser le mot de passe"
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-muted"
          >
            Précédent
          </button>
          <span className="text-sm text-muted-foreground">
            Page {page} sur {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-muted"
          >
            Suivant
          </button>
        </div>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}
