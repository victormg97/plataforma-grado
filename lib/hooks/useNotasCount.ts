'use client';

import { useQuery } from '@tanstack/react-query';

async function fetchNotasCounts(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const res = await fetch(`/api/notas-clase/count?ids=${ids.join(',')}`);
  if (!res.ok) return {};
  return res.json();
}

export function useNotasCount(horarioIds: string[]) {
  const sortedIds = [...horarioIds].sort().join(',');

  const { data: counts = {} } = useQuery({
    queryKey: ['notas-count', sortedIds],
    queryFn: () => fetchNotasCounts(horarioIds),
    enabled: horarioIds.length > 0,
    staleTime: 60_000,
  });

  return counts;
}
