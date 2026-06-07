'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface UserSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

async function searchResellers(q: string): Promise<UserSearchResult[]> {
  const res = await apiClient.get('/users', {
    params: { search: q, role: 'RESELLER', limit: 10 },
  });
  return (res.data as { data: { items: UserSearchResult[] } }).data.items ?? [];
}

export function useResellerSearch() {
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(inputValue.trim());
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [inputValue]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['users', 'search', debouncedQuery],
    queryFn: () => searchResellers(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  return { inputValue, setInputValue, results, isFetching, debouncedQuery };
}
