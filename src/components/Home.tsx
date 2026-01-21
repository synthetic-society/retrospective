import { useState, useEffect, useRef } from 'preact/hooks';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '../lib/store';
import { getSessionHistory, removeFromSessionHistory } from '../lib/store';
import { useCreateSession, createQueryClient } from '../lib/queries';
import { DEMO_SESSION_ID } from '../lib/constants';

// Native date formatter
const formatDate = (dateStr: string) => {
  return new Intl.DateTimeFormat('default').format(new Date(dateStr));
};

export default function Home() {
  const qc = useRef(createQueryClient());
  return (
    <QueryClientProvider client={qc.current}>
      <HomeContent />
    </QueryClientProvider>
  );
}

function HomeContent() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [name, setName] = useState('');
  const create = useCreateSession();

  useEffect(() => {
    setSessions(getSessionHistory());
  }, []);

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    if (!name.trim() || create.isPending) return;
    const session = await create.mutateAsync(name.trim());
    window.location.href = `/${session.id}`;
  };

  const handleRemove = (id: string, e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    removeFromSessionHistory(id);
    setSessions(getSessionHistory());
  };

  return (
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-lg">
        <div class="text-center mb-8">
          <h1 class="text-2xl md:text-3xl font-semibold text-sketch-dark mb-2 tracking-wider hand-drawn">
            ~ Retrospective ~
          </h1>
          <div class="text-sketch-medium text-sm hand-drawn">═══════════════════════════════════</div>
        </div>

        <form onSubmit={handleCreate} class="mb-10">
          <div class="border-2 border-sketch-dark bg-white/60 p-4 rounded hand-drawn">
            <label class="block text-sketch-medium text-xs mb-2 uppercase tracking-wider hand-drawn">
              Session Name:
            </label>
            <div class="flex gap-2">
              <input
                type="text"
                value={name}
                onInput={e => setName((e.target as HTMLInputElement).value)}
                placeholder="Sprint 42 Retro"
                class="input flex-1 font-mono text-sm hand-drawn"
                disabled={create.isPending}
              />
              <button
                type="submit"
                disabled={!name.trim() || create.isPending}
                class="btn-primary btn-md font-mono uppercase tracking-wider hand-drawn"
              >
                {create.isPending ? '...' : 'Create'}
              </button>
            </div>
          </div>
        </form>

        <div class="text-center mb-8">
          <a
            href={`/${DEMO_SESSION_ID}`}
            class="text-sketch-medium hover:text-sketch-dark transition-colors text-sm hand-drawn underline"
          >
            or try the demo →
          </a>
        </div>

        <div>
          <div class="text-center text-sketch-medium text-xs mb-4 uppercase tracking-widest hand-drawn">
            ─── Previous Sessions ───
          </div>
          {sessions.length === 0 ? (
            <div class="text-center text-sketch-medium italic py-8 border-2 border-dashed border-sketch-medium rounded hand-drawn">
              (No sessions yet? Create one above!)
            </div>
          ) : (
            <div class="space-y-2">
              {sessions.map(s => (
                <a
                  key={s.id}
                  href={`/${s.id}`}
                  class="group block border-2 border-sketch-dark bg-white/60 hover:bg-white hover:border-sketch-dark transition-all rounded p-3 hand-drawn cursor-pointer"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 text-sketch-dark">
                      <span>▸</span>
                      <span class="font-medium">{s.name}</span>
                    </div>
                    <button
                      onClick={e => handleRemove(s.id, e)}
                      class="text-sketch-medium hover:text-sketch-dark transition-colors px-2 cursor-pointer"
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                  <div class="text-sketch-medium text-xs mt-1 ml-5">{formatDate(s.created_at)}</div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
