import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEMO_SESSION_ID } from './constants';
import type { Card, ColumnType, Session } from './store';
import { addToSessionHistory, getAdminToken, getVoterId, removeFromSessionHistory } from './store';

const request = (url: string, options?: RequestInit) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const res = fetch(`/api/${url}`, { ...options, signal: controller.signal }).then((r) => {
    clearTimeout(timeout);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  });
  return { res, json: <T>() => res.then((r) => r.json() as Promise<T>) };
};

const api = {
  get: (url: string) => request(url),
  post: (url: string, opts: { json: unknown }) =>
    request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts.json) }),
  patch: (url: string, opts: { json: unknown }) =>
    request(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(opts.json) }),
  delete: (url: string, opts?: { headers?: HeadersInit }) =>
    request(url, { method: 'DELETE', headers: opts?.headers }).res,
};

// Demo cards to seed the demo board
const DEMO_CARDS: Card[] = [
  {
    id: 'demo-1',
    session_id: DEMO_SESSION_ID,
    column_type: 'glad',
    content: 'Paper accepted at CHI 2026! Great teamwork on the revisions.',
    votes: 5,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-2',
    session_id: DEMO_SESSION_ID,
    column_type: 'glad',
    content: 'New PhD student onboarding went smoothly',
    votes: 2,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-3',
    session_id: DEMO_SESSION_ID,
    column_type: 'glad',
    content: 'Weekly reading group discussions have been really insightful',
    votes: 3,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-4',
    session_id: DEMO_SESSION_ID,
    column_type: 'wondering',
    content: 'Should we move lab meetings to a different time slot?',
    votes: 2,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-5',
    session_id: DEMO_SESSION_ID,
    column_type: 'wondering',
    content: 'How can we better support undergrads doing research?',
    votes: 1,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-6',
    session_id: DEMO_SESSION_ID,
    column_type: 'sad',
    content: "Paper submission deadline crunch affected everyone's well-being",
    votes: 4,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-7',
    session_id: DEMO_SESSION_ID,
    column_type: 'sad',
    content: 'Hard to book meeting rooms for user studies',
    votes: 2,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-8',
    session_id: DEMO_SESSION_ID,
    column_type: 'action',
    content: 'Set up shared calendar for equipment bookings',
    votes: 3,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-9',
    session_id: DEMO_SESSION_ID,
    column_type: 'action',
    content: 'Create a mentorship pairing for new lab members',
    votes: 4,
    created_at: new Date().toISOString(),
  },
];

const queryKeys = {
  session: (sessionId: string) => ['session', sessionId] as const,
  cards: (sessionId: string) => ['cards', sessionId] as const,
  votes: (sessionId: string, clientId: string) => ['votes', sessionId, clientId] as const,
};

// Invalidate session query after a successful mutation (skipped in demo mode)
const invalidateSession = (qc: QueryClient, sessionId: string, isDemo: boolean) => {
  if (!isDemo) qc.invalidateQueries({ queryKey: queryKeys.session(sessionId) });
};

// Optimistic-update plumbing: cancel in-flight queries and snapshot the given keys,
// returning a context that `rollback` restores on error.
const snapshot = async (qc: QueryClient, keys: readonly (readonly unknown[])[]) => {
  await Promise.all(keys.map((key) => qc.cancelQueries({ queryKey: key })));
  return keys.map((key) => [key, qc.getQueryData(key)] as const);
};

const rollback = (qc: QueryClient, ctx?: readonly (readonly [readonly unknown[], unknown])[]) => {
  for (const [key, data] of ctx ?? []) if (data !== undefined) qc.setQueryData(key, data);
};

export const useSession = (sessionId: string, initialData?: Session, isDemo = false) =>
  useQuery({
    queryKey: queryKeys.session(sessionId),
    queryFn: async () => {
      if (isDemo) return initialData as Session;
      const session = await api.get(`sessions/${sessionId}`).json<Session>();
      addToSessionHistory(session);
      return session;
    },
    initialData,
    staleTime: isDemo ? Infinity : 30000, // Session data doesn't change often
    refetchOnWindowFocus: !isDemo,
  });

export const createQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { staleTime: 2000, refetchOnWindowFocus: true, retry: 2 } } });

export const useCards = (sessionId: string, isDemo = false) =>
  useQuery({
    queryKey: queryKeys.cards(sessionId),
    queryFn: () => (isDemo ? Promise.resolve(DEMO_CARDS) : api.get(`sessions/${sessionId}/cards`).json<Card[]>()),
    initialData: isDemo ? DEMO_CARDS : undefined,
    refetchInterval: isDemo ? false : 10000, // Poll every 10s (disabled for demo)
    refetchIntervalInBackground: false, // Pause polling when tab is hidden
    staleTime: isDemo ? Infinity : 2000,
    refetchOnWindowFocus: !isDemo,
  });

export const useVotes = (sessionId: string, isDemo = false) => {
  const voterId = getVoterId(sessionId);
  return useQuery({
    queryKey: queryKeys.votes(sessionId, voterId),
    queryFn: () =>
      isDemo ? Promise.resolve([]) : api.get(`sessions/${sessionId}/votes?voter_id=${voterId}`).json<string[]>(),
    initialData: isDemo ? [] : undefined,
    refetchInterval: isDemo ? false : 10000, // Poll every 10s (disabled for demo)
    refetchIntervalInBackground: false, // Pause polling when tab is hidden
    staleTime: isDemo ? Infinity : 2000,
    refetchOnWindowFocus: !isDemo,
    select: (data) => new Set(data || []),
  });
};

export const useAddCard = (sessionId: string, isDemo = false) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ columnType, content }: { columnType: ColumnType; content: string }) => {
      if (isDemo) {
        // Return a mock card for demo mode
        return {
          id: `demo-${Date.now()}`,
          session_id: sessionId,
          column_type: columnType,
          content,
          votes: 0,
          created_at: new Date().toISOString(),
        } as Card;
      }
      return api.post(`sessions/${sessionId}/cards`, { json: { column_type: columnType, content } }).json<Card>();
    },
    onSuccess: (card) => {
      qc.setQueryData<Card[]>(queryKeys.cards(sessionId), (old) => [...(old || []), card]);
      invalidateSession(qc, sessionId, isDemo);
    },
  });
};

export const useUpdateCard = (sessionId: string, isDemo = false) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      if (isDemo) {
        // Return updated card for demo mode
        const cards = qc.getQueryData<Card[]>(queryKeys.cards(sessionId)) || [];
        const card = cards.find((c) => c.id === id);
        if (!card) throw new Error('Card not found');
        return { ...card, content };
      }
      return api.patch(`cards/${id}`, { json: { session_id: sessionId, content } }).json<Card>();
    },
    onSuccess: (card) => {
      qc.setQueryData<Card[]>(
        queryKeys.cards(sessionId),
        (old) => old?.map((c) => (c.id === card.id ? card : c)) ?? [],
      );
      invalidateSession(qc, sessionId, isDemo);
    },
  });
};

export const useDeleteCard = (sessionId: string, isDemo = false) => {
  const qc = useQueryClient();
  const key = queryKeys.cards(sessionId);
  return useMutation({
    mutationFn: async (id: string) => {
      if (isDemo) return; // No API call in demo mode
      return api.delete(`cards/${id}?session_id=${sessionId}`);
    },
    onMutate: async (id) => {
      const ctx = await snapshot(qc, [key]);
      qc.setQueryData<Card[]>(key, (old) => old?.filter((c) => c.id !== id) ?? []);
      return ctx;
    },
    onSuccess: () => invalidateSession(qc, sessionId, isDemo),
    onError: (_, __, ctx) => rollback(qc, ctx),
  });
};

export const useToggleVote = (sessionId: string, isDemo = false) => {
  const qc = useQueryClient();
  const voterId = getVoterId(sessionId);
  const cardsKey = queryKeys.cards(sessionId);
  const votesKey = queryKeys.votes(sessionId, voterId);

  return useMutation({
    mutationFn: async (cardId: string) => {
      if (isDemo) return; // No API call in demo mode
      return api.patch(`cards/${cardId}/vote`, { json: { session_id: sessionId, voter_id: voterId } });
    },
    onMutate: async (cardId) => {
      const ctx = await snapshot(qc, [cardsKey, votesKey]);
      const hasVoted = new Set(qc.getQueryData<string[]>(votesKey) || []).has(cardId);

      qc.setQueryData<string[]>(votesKey, (old = []) =>
        hasVoted ? old.filter((id) => id !== cardId) : [...old, cardId],
      );
      qc.setQueryData<Card[]>(
        cardsKey,
        (old) =>
          old?.map((c) => (c.id === cardId ? { ...c, votes: Math.max(0, c.votes + (hasVoted ? -1 : 1)) } : c)) ?? [],
      );
      return ctx;
    },
    onSuccess: () => invalidateSession(qc, sessionId, isDemo),
    onError: (_, __, ctx) => rollback(qc, ctx),
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

export const useDeleteSession = () =>
  useMutation({
    mutationFn: async (sessionId: string) => {
      const adminToken = getAdminToken(sessionId);
      if (!adminToken) throw new Error('No admin token for this session');
      await api.delete(`sessions/${sessionId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
      removeFromSessionHistory(sessionId);
    },
  });
