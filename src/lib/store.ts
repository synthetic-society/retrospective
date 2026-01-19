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

const isBrowser = typeof window !== 'undefined';
const storage = <T>(key: string, fallback: T) =>
  isBrowser ? JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) : fallback;

export const getClientId = (): string => {
  if (!isBrowser) return '';
  let id = localStorage.getItem('retro_client_id');
  if (!id) localStorage.setItem('retro_client_id', (id = crypto.randomUUID()));
  return id;
};

const SESSIONS_KEY = 'retro_sessions';

export const getSessionHistory = (): Session[] => storage(SESSIONS_KEY, []);

export const addToSessionHistory = (session: Session): void => {
  if (!isBrowser) return;
  const sessions = getSessionHistory().filter(s => s.id !== session.id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify([session, ...sessions].slice(0, 20)));
};

export const removeFromSessionHistory = (id: string): void => {
  if (!isBrowser) return;
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(getSessionHistory().filter(s => s.id !== id)));
};
