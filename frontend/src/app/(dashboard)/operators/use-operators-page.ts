'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, unwrap } from '@/lib/api';
import { adminApi, type Operator, type ProvisionResult, type SaasTier } from '@/lib/api/admin';
import { usersApi } from '@/lib/api/users';
import { apiError } from '@/lib/api/client';
import { hasPermission } from '@/lib/permissions';

export type StatusFilter = 'ALL' | 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED';

interface AuthUser {
  id: string;
  role: string;
  email: string;
  permissions?: string[];
}

export type ProvisionPayload = {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  tierId?: string;
  billingCycle?: 'MONTHLY' | 'YEARLY';
};

export function isExpiringSoon(endDate: string | null, status: string | null = 'ACTIVE'): boolean {
  if (!endDate || status !== 'ACTIVE') return false;
  const remaining = new Date(endDate).getTime() - Date.now();
  return remaining > 0 && remaining < 7 * 24 * 60 * 60 * 1000;
}

export function useOperatorsPage() {
  const qc = useQueryClient();

  const [showProvision, setShowProvision] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Operator | null>(null);
  const [tempPassword, setTempPassword] = useState<{ password: string; email: string } | null>(null);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<Operator | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<{
    op: Operator;
    action: 'suspend' | 'unsuspend';
  } | null>(null);

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const deferredSearch = useDeferredValue(search);

  const { data: meData, isLoading: isMeLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60_000,
  });
  const currentUser = meData ? unwrap<AuthUser>(meData) : null;
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const canManage = hasPermission(currentUser, 'users.manage');

  const {
    data: opsData,
    isLoading: isOpsLoading,
    isError: isOpsError,
    refetch: refetchOperators,
  } = useQuery({
    queryKey: ['operators'],
    queryFn: async () =>
      unwrap<{ items: Operator[]; total: number }>(await adminApi.listOperators(1, 100)),
    staleTime: 30_000,
    enabled: isSuperAdmin,
  });

  const { data: tiers = [] } = useQuery({
    queryKey: ['admin-tiers'],
    queryFn: async () => unwrap<SaasTier[]>(await adminApi.listTiers()),
    staleTime: 60_000,
    enabled: isSuperAdmin,
  });

  const operators = opsData?.items ?? [];

  const globalStats = useMemo(
    () => ({
      total: operators.length,
      active: operators.filter((o) => o.subscriptionStatus === 'ACTIVE').length,
      expiringSoon: operators.filter((o) =>
        isExpiringSoon(o.subscriptionEndDate, o.subscriptionStatus),
      ).length,
      revenueThisMonth: operators.reduce((s, o) => s + o.revenueThisMonthXof, 0),
    }),
    [operators],
  );

  const filteredOperators = useMemo(() => {
    const q = deferredSearch.toLowerCase().trim();
    return operators.filter((op) => {
      if (q && !`${op.firstName} ${op.lastName} ${op.email}`.toLowerCase().includes(q))
        return false;
      if (tierFilter !== 'ALL' && op.tierSlug !== tierFilter) return false;
      if (statusFilter !== 'ALL' && op.subscriptionStatus !== statusFilter) return false;
      return true;
    });
  }, [operators, deferredSearch, tierFilter, statusFilter]);

  const provisionMutation = useMutation({
    mutationFn: (data: ProvisionPayload) => adminApi.provisionOperator(data),
    onSuccess: (res) => {
      const result = unwrap<ProvisionResult>(res);
      void qc.invalidateQueries({ queryKey: ['operators'] });
      setShowProvision(false);
      setProvisionError(null);
      setTempPassword({ password: result.tempPassword, email: result.operator.email });
    },
    onError: (err) => setProvisionError(apiError(err)),
  });

  const assignTierMutation = useMutation({
    mutationFn: ({
      operatorId,
      tierId,
      billingCycle,
    }: {
      operatorId: string;
      tierId: string;
      billingCycle: 'MONTHLY' | 'YEARLY';
    }) => adminApi.assignSubscription(operatorId, tierId, billingCycle),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['operators'] });
      setAssignTarget(null);
      setAssignError(null);
      toast.success('Abonnement assigné');
    },
    onError: (err) => setAssignError(apiError(err)),
  });

  const renewMutation = useMutation({
    mutationFn: (operatorId: string) => adminApi.renewSubscription(operatorId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['operators'] });
      toast.success('Abonnement renouvelé');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const cancelMutation = useMutation({
    mutationFn: (operatorId: string) =>
      adminApi.cancelSubscription(operatorId, 'Résiliation manuelle'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['operators'] });
      toast.success('Abonnement résilié');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (operatorId: string) => usersApi.resetPasswordGenerate(operatorId),
    onSuccess: (res, operatorId) => {
      const result = unwrap<{ tempPassword: string }>(res);
      const op = operators.find((o) => o.id === operatorId);
      setResetPasswordTarget(null);
      setTempPassword({ password: result.tempPassword, email: op?.email ?? '' });
      toast.success('Mot de passe réinitialisé');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const suspendMutation = useMutation({
    mutationFn: (operatorId: string) => usersApi.suspend(operatorId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['operators'] });
      setSuspendTarget(null);
      toast.success('Compte suspendu');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const activateMutation = useMutation({
    mutationFn: (operatorId: string) => usersApi.activate(operatorId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['operators'] });
      setSuspendTarget(null);
      toast.success('Compte réactivé');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const renewingId =
    renewMutation.isPending && renewMutation.variables != null
      ? renewMutation.variables
      : null;
  const cancellingId =
    cancelMutation.isPending && cancelMutation.variables != null
      ? cancelMutation.variables
      : null;
  const resettingPasswordId =
    resetPasswordMutation.isPending && resetPasswordMutation.variables != null
      ? resetPasswordMutation.variables
      : null;
  const suspendingId =
    (suspendMutation.isPending && suspendMutation.variables != null
      ? suspendMutation.variables
      : null) ??
    (activateMutation.isPending && activateMutation.variables != null
      ? activateMutation.variables
      : null);

  return {
    isMeLoading,
    isSuperAdmin,
    canManage,
    operators,
    filteredOperators,
    tiers,
    globalStats,
    isOpsLoading,
    isOpsError,
    refetchOperators,
    search,
    setSearch,
    tierFilter,
    setTierFilter,
    statusFilter,
    setStatusFilter,
    showProvision,
    setShowProvision,
    assignTarget,
    setAssignTarget,
    tempPassword,
    setTempPassword,
    provisionError,
    setProvisionError,
    assignError,
    setAssignError,
    resetPasswordTarget,
    setResetPasswordTarget,
    suspendTarget,
    setSuspendTarget,
    provisionMutation,
    assignTierMutation,
    renewMutation,
    cancelMutation,
    resetPasswordMutation,
    suspendMutation,
    activateMutation,
    renewingId,
    cancellingId,
    resettingPasswordId,
    suspendingId,
  };
}
