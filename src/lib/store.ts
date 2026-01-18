import ky from 'ky';

// Types
export interface Session {
  id: string;
  name: string;
  created_at: string;
}

export interface Card {
  id: string;
  session_id: string;
  column_type: 'glad' | 'wondering' | 'sad' | 'action';
  content: string;
  votes: number;
  created_at: string;
}

export type ColumnType = Card['column_type'];

// Client ID for anonymous voting
export const getClientId = (): string => {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('retro_client_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('retro_client_id', id);
  }
  return id;
};

// Session history
const SESSIONS_KEY = 'retro_sessions';

export const getSessionHistory = (): Session[] => {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
};

export const addToSessionHistory = (session: Session): void => {
  if (typeof window === 'undefined') return;
  const sessions = getSessionHistory().filter(s => s.id !== session.id);
  sessions.unshift(session);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 20)));
};

export const removeFromSessionHistory = (id: string): void => {
  if (typeof window === 'undefined') return;
  const sessions = getSessionHistory().filter(s => s.id !== id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
};

// API client
const api = ky.extend({ prefixUrl: '/api', timeout: 10000 });

// Session operations
export const createSession = async (name: string): Promise<Session> => {
  const session = await api.post('sessions', { json: { name } }).json<Session>();
  addToSessionHistory(session);
  return session;
};

export const getSession = async (id: string): Promise<Session | null> => {
  try {
    return await api.get(`sessions/${id}`).json<Session>();
  } catch (error: any) {
    if (error.response?.status === 404) return null;
    throw error;
  }
};

// Store
export interface Store {
  cards: Card[];
  votedCardIds: Set<string>;
  load: () => Promise<void>;
  addCard: (columnType: ColumnType, content: string) => Promise<Card>;
  updateCard: (id: string, content: string) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  toggleVote: (cardId: string) => Promise<void>;
  subscribe: (cb: () => void) => () => void;
}

export const createStore = (sessionId: string, clientId: string): Store => {
  let cards: Card[] = [];
  let votedCardIds = new Set<string>();
  let listeners: (() => void)[] = [];
  let pollInterval: number | null = null;

  const notify = () => listeners.forEach(cb => cb());

  const updateCards = (updateFn: (cards: Card[]) => Card[]) => {
    cards = updateFn(cards);
    notify();
  };

  const updateCardVotes = (cardId: string, delta: number) => {
    updateCards(c =>
      c.map(card =>
        card.id === cardId ? { ...card, votes: Math.max(0, card.votes + delta) } : card
      )
    );
  };

  const poll = async () => {
    try {
      const [newCards, newVotes] = await Promise.all([
        api.get(`sessions/${sessionId}/cards`).json<Card[]>(),
        api.get(`sessions/${sessionId}/votes?voter_id=${clientId}`).json<string[]>(),
      ]);

      const cardsChanged = JSON.stringify(newCards) !== JSON.stringify(cards);
      const votesChanged =
        JSON.stringify([...votedCardIds].sort()) !== JSON.stringify((newVotes || []).sort());

      if (cardsChanged || votesChanged) {
        cards = newCards || [];
        votedCardIds = new Set(newVotes || []);
        notify();
      }
    } catch (e) {
      console.error('Poll error:', e);
    }
  };

  return {
    get cards() {
      return cards;
    },
    get votedCardIds() {
      return votedCardIds;
    },

    async load() {
      const [loadedCards, votes] = await Promise.all([
        api.get(`sessions/${sessionId}/cards`).json<Card[]>(),
        api.get(`sessions/${sessionId}/votes?voter_id=${clientId}`).json<string[]>(),
      ]);
      cards = loadedCards || [];
      votedCardIds = new Set(votes || []);
      notify();
    },

    async addCard(columnType, content) {
      const card = await api
        .post(`sessions/${sessionId}/cards`, { json: { column_type: columnType, content } })
        .json<Card>();
      updateCards(c => [...c, card]);
      return card;
    },

    async updateCard(id, content) {
      const updated = await api.patch(`cards/${id}`, { json: { content } }).json<Card>();
      updateCards(c => c.map(card => (card.id === id ? updated : card)));
    },

    async deleteCard(id) {
      await api.delete(`cards/${id}`);
      updateCards(c => c.filter(card => card.id !== id));
    },

    async toggleVote(cardId) {
      const hasVoted = votedCardIds.has(cardId);

      try {
        await api.patch(`cards/${cardId}/vote`, { json: { voter_id: clientId } });

        if (hasVoted) {
          votedCardIds.delete(cardId);
          updateCardVotes(cardId, -1);
        } else {
          votedCardIds.add(cardId);
          updateCardVotes(cardId, +1);
        }
      } catch (error) {
        console.error('Vote toggle failed:', error);
        throw error;
      }
    },

    subscribe(cb) {
      listeners.push(cb);
      if (listeners.length === 1) {
        pollInterval = window.setInterval(poll, 3000);
      }
      return () => {
        listeners = listeners.filter(l => l !== cb);
        if (listeners.length === 0 && pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      };
    },
  };
};
