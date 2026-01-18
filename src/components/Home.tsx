import { useState, useEffect } from 'preact/hooks';
import { format } from 'date-fns';
import type { Session } from '../lib/store';
import { getSessionHistory, createSession, removeFromSessionHistory } from '../lib/store';

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    setSessions(getSessionHistory());
  }, []);

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    if (!newName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      const session = await createSession(newName.trim());
      window.location.href = `/${session.id}`;
    } catch (error) {
      console.error('Failed to create session:', error);
      setIsCreating(false);
    }
  };

  const handleRemove = (id: string, e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    removeFromSessionHistory(id);
    setSessions(getSessionHistory());
  };

  const formatDate = (dateStr: string) => format(new Date(dateStr), 'yyyy.MM.dd // HH:mm');

  return (
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="w-full max-w-lg">
        {/* Header */}
        <div class="text-center mb-8">
          <h1 class="text-2xl md:text-3xl font-semibold text-sketch-dark mb-2 tracking-wider hand-drawn">
            ~ Retrospective ~
          </h1>
          <div class="text-sketch-medium text-sm hand-drawn">
            ═══════════════════════════════════
          </div>
        </div>

        {/* Create Form */}
        <form onSubmit={handleCreate} class="mb-10">
          <div class="border-2 border-sketch-dark bg-white/60 p-4 rounded hand-drawn">
            <label class="block text-sketch-medium text-xs mb-2 uppercase tracking-wider hand-drawn">
              Session Name:
            </label>
            <div class="flex gap-2">
              <input
                type="text"
                value={newName}
                onInput={e => setNewName((e.target as HTMLInputElement).value)}
                placeholder="Sprint 42 Retro"
                class="flex-1 bg-white border-2 border-sketch-medium text-sketch-dark px-3 py-2 rounded font-mono text-sm focus:border-sketch-dark focus:outline-none transition-all hand-drawn"
                disabled={isCreating}
              />
              <button
                type="submit"
                disabled={!newName.trim() || isCreating}
                class="px-4 py-2 border-2 border-sketch-dark text-sketch-dark font-mono text-sm uppercase tracking-wider hover:bg-sketch-dark hover:text-beige-light transition-all disabled:opacity-50 disabled:cursor-not-allowed rounded hand-drawn cursor-pointer"
              >
                {isCreating ? '...' : 'Create'}
              </button>
            </div>
          </div>
        </form>

        {/* Sessions List */}
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
              {sessions.map(session => (
                <a
                  key={session.id}
                  href={`/${session.id}`}
                  class="group block border-2 border-sketch-dark bg-white/60 hover:bg-white hover:border-sketch-dark transition-all rounded p-3 hand-drawn cursor-pointer"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2 text-sketch-dark">
                      <span>▸</span>
                      <span class="font-medium">{session.name}</span>
                    </div>
                    <button
                      onClick={e => handleRemove(session.id, e)}
                      class="text-sketch-medium hover:text-sketch-dark transition-colors px-2 cursor-pointer"
                      title="Remove from list"
                    >
                      ×
                    </button>
                  </div>
                  <div class="text-sketch-medium text-xs mt-1 ml-5">
                    {formatDate(session.created_at)}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
