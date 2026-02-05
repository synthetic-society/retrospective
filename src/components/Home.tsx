import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'preact/hooks';
import { DEMO_SESSION_ID } from '../lib/constants';
import { createQueryClient, useCreateSession, useDeleteSession } from '../lib/queries';
import type { Session } from '../lib/store';
import { getSessionHistory, hasAdminToken } from '../lib/store';
import ErrorBoundary from './ErrorBoundary';

// Native date formatter
const formatDate = (dateStr: string) => {
  return new Intl.DateTimeFormat('default').format(new Date(dateStr));
};

export default function Home() {
  const qc = useRef(createQueryClient());
  return (
    <ErrorBoundary>
      <QueryClientProvider client={qc.current}>
        <HomeContent />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

function HomeContent() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [name, setName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const create = useCreateSession();
  const deleteSession = useDeleteSession();

  useEffect(() => {
    setSessions(getSessionHistory());
    // Re-read localStorage when returning to this page (e.g., after visiting a board)
    // The board's useSession() fetches fresh expires_at from the server and updates localStorage
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setSessions(getSessionHistory());
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    if (!name.trim() || create.isPending) return;
    const session = await create.mutateAsync(name.trim());
    window.location.href = `/${session.id}`;
  };

  const handleDeleteClick = (id: string, e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirm(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    await deleteSession.mutateAsync(deleteConfirm);
    setSessions(getSessionHistory());
    setDeleteConfirm(null);
  };

  const formatExpiry = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const expiry = new Date(expiresAt);
    const now = new Date();
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) return 'Expired';
    if (daysLeft === 1) return 'Expires tomorrow';
    return `Expires in ${daysLeft} days`;
  };

  return (
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-lg">
        <div class="text-center mb-8">
          <h1 class="text-2xl md:text-3xl font-semibold text-sketch-dark mb-2 tracking-wider">~ Retrospective ~</h1>
          <div class="text-sketch-medium text-sm">═══════════════════════════════════</div>
        </div>

        <form onSubmit={handleCreate} class="mb-10">
          <div class="bg-white/60 p-4 rounded doodly-border">
            <label class="block text-sketch-medium text-xs mb-2 uppercase tracking-wider" for="session-name">
              Session Name:
            </label>
            <div class="flex gap-2">
              <input
                id="session-name"
                type="text"
                value={name}
                onInput={(e) => setName((e.target as HTMLInputElement).value)}
                placeholder="Sprint 42 Retro"
                class="input flex-1 font-mono text-sm"
                disabled={create.isPending}
              />
              <button
                type="submit"
                disabled={!name.trim() || create.isPending}
                class="btn-primary btn-md font-mono uppercase tracking-wider"
              >
                {create.isPending ? '...' : 'Create'}
              </button>
            </div>
          </div>
        </form>

        <div class="text-center mb-8">
          <a
            href={`/${DEMO_SESSION_ID}`}
            class="text-sketch-medium hover:text-sketch-dark transition-colors text-sm underline"
          >
            or try the demo →
          </a>
        </div>

        <div>
          <div class="text-center text-sketch-medium text-xs mb-4 uppercase tracking-widest">
            ─── Sessions you created ───
          </div>
          {sessions.length === 0 ? (
            <div class="text-center text-sketch-medium italic py-8 rounded doodly-border-dashed">
              (No sessions yet? Create one above!)
            </div>
          ) : (
            <div class="space-y-2">
              {sessions.map((s) => (
                <a
                  key={s.id}
                  href={`/${s.id}`}
                  class="group block bg-white/60 hover:bg-white transition-all rounded p-3 doodly-border cursor-pointer"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 text-sketch-dark">
                      <span>▸</span>
                      <span class="font-medium">{s.name}</span>
                    </div>
                    {hasAdminToken(s.id) && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(s.id, e)}
                        class="btn-danger btn-sm uppercase tracking-wider"
                        title="Delete session"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <div class="flex justify-between items-center text-sketch-medium text-xs mt-1 ml-5">
                    <span>{formatDate(s.created_at)}</span>
                    {s.expires_at && <span class="text-sketch-medium/70">{formatExpiry(s.expires_at)}</span>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {deleteConfirm && (
          <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div class="bg-white rounded p-6 max-w-sm mx-4 doodly-border">
              <h3 class="text-lg font-semibold text-sketch-dark mb-4">Delete Session?</h3>
              <p class="text-sketch-medium mb-6">
                This will permanently delete the session and all its cards. This action cannot be undone.
              </p>
              <div class="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  class="px-4 py-2 border-2 border-sketch-dark rounded hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleteSession.isPending}
                  class="px-4 py-2 bg-red-500 text-white border-2 border-red-600 rounded hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {deleteSession.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        <footer class="mt-8 text-center">
          <a href="/privacy" class="text-sketch-medium text-xs hover:text-sketch-dark underline">
            Privacy Policy
          </a>
        </footer>
      </div>
    </div>
  );
}
