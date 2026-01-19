import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import ky from 'ky';
import type { Session, Card } from './store';
import { getClientId, addToSessionHistory } from './store';

const api = ky.extend({ prefixUrl: '/api', timeout: 10000 });

export const queryKeys = {
  cards: (sessionId: string) => ['cards', sessionId] as const,
  votes: (sessionId: string, clientId: string) => ['votes', sessionId, clientId] as const,
};

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { staleTime: 2000, refetchOnWindowFocus: true, retry: 2 },
    },
  });

export const useCards = (sessionId: string) =>
  useQuery({
    queryKey: queryKeys.cards(sessionId),
    queryFn: () => api.get(`sessions/${sessionId}/cards`).json<Card[]>(),
    refetchInterval: 3000,
    refetchIntervalInBackground: false, // Pause polling when tab is hidden
  });

export const useVotes = (sessionId: string) => {
  const clientId = getClientId();
  return useQuery({
    queryKey: queryKeys.votes(sessionId, clientId),
    queryFn: () => api.get(`sessions/${sessionId}/votes?voter_id=${clientId}`).json<string[]>(),
    refetchInterval: 3000,
    refetchIntervalInBackground: false, // Pause polling when tab is hidden
    select: data => new Set(data || []),
  });
};

export const useAddCard = (sessionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ columnType, content }: { columnType: Card['column_type']; content: string }) =>
      api.post(`sessions/${sessionId}/cards`, { json: { column_type: columnType, content } }).json<Card>(),
    onSuccess: card => qc.setQueryData<Card[]>(queryKeys.cards(sessionId), old => [...(old || []), card]),
  });
};

export const useUpdateCard = (sessionId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.patch(`cards/${id}`, { json: { content } }).json<Card>(),
    onSuccess: card =>
      qc.setQueryData<Card[]>(queryKeys.cards(sessionId), old => old?.map(c => (c.id === card.id ? card : c)) ?? []),
  });
};

export const useDeleteCard = (sessionId: string) => {
  const qc = useQueryClient();
  const key = queryKeys.cards(sessionId);
  return useMutation({
    mutationFn: (id: string) => api.delete(`cards/${id}`),
    onMutate: async id => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Card[]>(key);
      qc.setQueryData<Card[]>(key, old => old?.filter(c => c.id !== id) ?? []);
      return { prev };
    },
    onError: (_, __, ctx) => ctx?.prev && qc.setQueryData(key, ctx.prev),
  });
};

export const useToggleVote = (sessionId: string) => {
  const qc = useQueryClient();
  const clientId = getClientId();
  const cardsKey = queryKeys.cards(sessionId);
  const votesKey = queryKeys.votes(sessionId, clientId);

  return useMutation({
    mutationFn: (cardId: string) => api.patch(`cards/${cardId}/vote`, { json: { voter_id: clientId } }),
    onMutate: async cardId => {
      await Promise.all([qc.cancelQueries({ queryKey: cardsKey }), qc.cancelQueries({ queryKey: votesKey })]);
      const prevCards = qc.getQueryData<Card[]>(cardsKey);
      const prevVotes = qc.getQueryData<string[]>(votesKey);
      const hasVoted = new Set(prevVotes || []).has(cardId);

      qc.setQueryData<string[]>(votesKey, (old = []) =>
        hasVoted ? old.filter(id => id !== cardId) : [...old, cardId]
      );
      qc.setQueryData<Card[]>(
        cardsKey,
        old => old?.map(c => (c.id === cardId ? { ...c, votes: Math.max(0, c.votes + (hasVoted ? -1 : 1)) } : c)) ?? []
      );
      return { prevCards, prevVotes };
    },
    onError: (_, __, ctx) => {
      ctx?.prevCards && qc.setQueryData(cardsKey, ctx.prevCards);
      ctx?.prevVotes && qc.setQueryData(votesKey, ctx.prevVotes);
    },
  });
};

export const useCreateSession = () =>
  useMutation({
    mutationFn: async (name: string) => {
      const session = await api.post('sessions', { json: { name } }).json<Session>();
      addToSessionHistory(session);
      return session;
    },
  });
