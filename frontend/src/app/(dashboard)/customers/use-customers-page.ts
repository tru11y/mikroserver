'use client';

import { useDeferredValue, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { customersApi } from '@/lib/api/customers';
import { routersApi } from '@/lib/api/routers';
import { api, unwrap } from '@/lib/api';
import { hasPermission } from '@/lib/permissions';

const PAGE_SIZE = 25;

interface CustomerStats {
  total: number;
  newThisWeek: number;
  activeThisWeek: number;
}

export function useCustomersPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const [search, setSearchRaw] = useState(searchParams.get('search') ?? '');
  const deferredSearch = useDeferredValue(search);
  const [routerId, setRouterId] = useState('');

  function setPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function setSearch(value: string) {
    setSearchRaw(value);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Auth / permissions
  const { data: meData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api.auth.me(),
    staleTime: 5 * 60 * 1000,
  });
  const currentUser = meData ? unwrap<Record<string, unknown>>(meData) : null;
  const canBlock = hasPermission(currentUser, 'customers.block') || hasPermission(currentUser, 'customers.manage');
  const canDelete = hasPermission(currentUser, 'customers.delete') || hasPermission(currentUser, 'customers.manage');

  // Stats
  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['customers-stats'],
    queryFn: async () => {
      const res = await customersApi.getStats();
      return unwrap<CustomerStats>(res);
    },
    staleTime: 60_000,
  });

  // Routers list (for filter)
  const { data: routers = [] } = useQuery({
    queryKey: ['routers-minimal'],
    queryFn: async () => {
      const res = await routersApi.list({});
      const list = unwrap<{ id: string; name: string }[]>(res);
      return list.map(({ id, name }) => ({ id, name }));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Customers list
  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['customers', page, deferredSearch, routerId],
    queryFn: async () => {
      const res = await customersApi.findAll({
        page,
        limit: PAGE_SIZE,
        search: deferredSearch || undefined,
        routerId: routerId || undefined,
      });
      return unwrap<{ items: import('@/lib/api/customers').CustomerProfile[]; total: number }>(res);
    },
    placeholderData: (prev) => prev,
  });

  const items = data?.items;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Block mutation
  const blockMutation = useMutation({
    mutationFn: ({ id, isBlocked }: { id: string; isBlocked: boolean }) =>
      customersApi.block(id, isBlocked),
    onSuccess: (_, { isBlocked }) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success(isBlocked ? 'Client bloqué' : 'Client débloqué');
    },
    onError: () => toast.error('Échec de la mise à jour'),
  });

  function onBlock(id: string, isBlocked: boolean) {
    blockMutation.mutate({ id, isBlocked });
  }

  return {
    // data
    stats,
    isStatsLoading,
    items,
    total,
    isLoading,
    isError,
    refetch,
    // pagination
    page,
    setPage,
    totalPages,
    // filters
    search,
    setSearch,
    routerId,
    setRouterId,
    routers,
    // permissions
    canBlock,
    canDelete,
    // actions
    onBlock,
    isBlockPending: blockMutation.isPending,
  };
}
