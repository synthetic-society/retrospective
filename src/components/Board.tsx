import { useRef, useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Card, ColumnType, Session } from '../lib/store';
import { createQueryClient, useSession, useCards, useVotes } from '../lib/queries';
import { AddCard, CardItem } from './Card';

const COLUMNS: { type: ColumnType; title: string; placeholder: string }[] = [
  { type: 'glad', title: 'What went well', placeholder: "I'm glad that…" },
  { type: 'wondering', title: 'Questions', placeholder: "I'm wondering about…" },
  { type: 'sad', title: 'Opportunities', placeholder: "It wasn't so great that…" },
  { type: 'action', title: 'Actions', placeholder: 'We should…' },
];

export default function Board({ session, isDemo = false }: { session: Session; isDemo?: boolean }) {
  const qc = useRef(createQueryClient());
  return (
    <QueryClientProvider client={qc.current}>
      <BoardContent session={session} isDemo={isDemo} />
    </QueryClientProvider>
  );
}

const expandedColumn = signal<ColumnType | null>('glad');
const copied = signal(false);
const isPlaying = signal(false);
const addingTo = signal<ColumnType | null>(null);
const animating = signal(new Map<string, 'up' | 'down'>());
const fullscreenColumn = signal<ColumnType | null>(null);

function BoardContent({ session: initialSession, isDemo = false }: { session: Session; isDemo?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: session = initialSession } = useSession(initialSession.id, initialSession, isDemo);

  const { data: cards = [], isLoading } = useCards(session.id, isDemo);
  const { data: votedIds = new Set<string>() } = useVotes(session.id, isDemo);

  const prevPositions = useRef(new Map<string, { column: ColumnType; index: number }>());

  const getPositions = (list: Card[]) =>
    new Map(
      COLUMNS.flatMap(col =>
        list
          .filter(c => c.column_type === col.type)
          .sort((a, b) => b.votes - a.votes)
          .map((card, i) => [card.id, { column: col.type, index: i }] as const)
      )
    );

  useEffect(() => {
    if (!cards.length) return;
    const newPos = getPositions(cards);
    const anims = new Map(
      [...newPos].flatMap(([id, np]) => {
        const op = prevPositions.current.get(id);
        if (op?.column === np.column && np.index !== op.index) {
          return [[id, np.index < op.index ? 'up' : 'down'] as const];
        }
        return [];
      })
    );
    if (anims.size) {
      animating.value = anims;
      setTimeout(() => (animating.value = new Map()), 400);
    }
    prevPositions.current = newPos;
  }, [cards]);

  // Close fullscreen view on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreenColumn.value) {
        fullscreenColumn.value = null;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  };

  const toggleMusic = () => {
    audioRef.current ??= Object.assign(new Audio('/kimiko-ishizaka-open-goldberg-variations-26.ogg'), { loop: true });
    isPlaying.value ? audioRef.current.pause() : audioRef.current.play().catch(console.error);
    isPlaying.value = !isPlaying.value;
  };

  const getColumnCards = (type: ColumnType) =>
    cards.filter(c => c.column_type === type).sort((a, b) => b.votes - a.votes);

  if (isLoading) {
    return (
      <div class="min-h-screen flex items-center justify-center">
        <div class="text-sketch-dark">~ Loading ~</div>
      </div>
    );
  }

  const fullscreenCol = fullscreenColumn.value ? COLUMNS.find(c => c.type === fullscreenColumn.value) : null;
  const fullscreenCards = fullscreenColumn.value ? getColumnCards(fullscreenColumn.value) : [];

  return (
    <div class="min-h-screen flex flex-col">
      {/* Fullscreen overlay */}
      {fullscreenCol && (
        <div class="fixed inset-0 z-50 bg-beige-light/95 overflow-auto" onClick={() => (fullscreenColumn.value = null)}>
          <div
            class="sticky top-0 z-10 bg-beige-light p-4 flex items-center justify-between doodly-border-b"
            onClick={e => e.stopPropagation()}
          >
            <h2 class="text-sketch-dark uppercase tracking-widest text-lg font-semibold">
              {fullscreenCol.title} ({fullscreenCards.length})
            </h2>
            <button
              onClick={() => (fullscreenColumn.value = null)}
              class="btn-primary btn-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sketch-dark focus-visible:ring-offset-2"
              title="Close fullscreen"
              aria-label="Close fullscreen"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="w-4 h-4"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div class="p-6" onClick={e => e.stopPropagation()}>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {fullscreenCards.map(card => (
                <CardItem
                  key={card.id}
                  card={card}
                  sessionId={session.id}
                  hasVoted={votedIds.has(card.id)}
                  animation={animating.value.get(card.id)}
                  isDemo={isDemo}
                />
              ))}
            </div>
            {fullscreenCards.length === 0 && (
              <div class="text-center text-sketch-medium italic py-12">No cards in this column yet</div>
            )}
          </div>
        </div>
      )}

      <header class="bg-white/40 p-3 flex items-center justify-between doodly-border-b">
        <a href="/" class="text-sketch-medium hover:text-sketch-dark transition-colors text-sm">
          ← Back
        </a>
        <h1 class="text-sketch-dark font-medium truncate mx-4">{session.name}</h1>
        <div class="flex gap-2">
          <button
            onClick={toggleMusic}
            class="btn-primary btn-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sketch-dark focus-visible:ring-offset-2"
            title={isPlaying.value ? 'Pause background music' : 'Play background music'}
            aria-label={isPlaying.value ? 'Pause background music' : 'Play background music'}
            aria-pressed={isPlaying.value}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="15 10 70 70"
              class="w-4 h-4 inline-block"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="m35 14c-1.0625 0.23828-1.9766 1.0977-2 2v49.094c-2.1289-1.9141-4.9297-3.0938-8-3.0938-6.6055 0-12 5.3945-12 12s5.3945 12 12 12 12-5.3945 12-12v-40h46v25.094c-2.1289-1.9141-4.9297-3.0938-8-3.0938-6.6055 0-12 5.3945-12 12s5.3945 12 12 12 12-5.3945 12-12v-52c0-1.0469-0.95312-2-2-2z" />
            </svg>
          </button>
          <button
            onClick={handleShare}
            class="btn-primary btn-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sketch-dark focus-visible:ring-offset-2"
            aria-label={copied.value ? 'Link copied to clipboard' : 'Copy share link to clipboard'}
            aria-live="polite"
          >
            {copied.value ? 'Copied!' : 'Share'}
          </button>
        </div>
      </header>

      <div class="flex-1 md:grid md:grid-cols-4 md:gap-4 md:p-4 overflow-y-auto">
        {COLUMNS.map(col => {
          const columnCards = getColumnCards(col.type);
          const isExpanded = expandedColumn.value === col.type;
          return (
            <div key={col.type}>
              <button
                onClick={() => (expandedColumn.value = isExpanded ? null : col.type)}
                class="md:hidden w-full p-3 flex items-center justify-between bg-white/60 doodly-border cursor-pointer hover:bg-white transition-all mx-2 my-2"
              >
                <div class="flex items-center gap-2">
                  <span class="text-sketch-dark">{isExpanded ? '▼' : '►'}</span>
                  <span class="text-sketch-dark uppercase tracking-widest text-sm font-semibold">
                    {col.title} ({columnCards.length})
                  </span>
                </div>
              </button>
              <div class={`${isExpanded ? 'block' : 'hidden'} md:flex md:flex-col column bg-white/60`}>
                <div class="hidden md:flex p-3 border-b-2 border-sketch-dark items-center justify-between">
                  <h2 class="text-sketch-dark uppercase tracking-widest text-sm font-semibold">{col.title}</h2>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      fullscreenColumn.value = col.type;
                    }}
                    class="text-sketch-medium hover:text-sketch-dark transition-colors p-1 rounded hover:bg-white/50 hover-woosh"
                    title={`View ${col.title} fullscreen`}
                    aria-label={`View ${col.title} fullscreen`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="w-4 h-4"
                      aria-hidden="true"
                    >
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                  </button>
                </div>
                <div class="flex-1 overflow-y-auto p-2 space-y-2">
                  {col.type === 'action' && columnCards.length === 0 && addingTo.value !== 'action' ? (
                    <div
                      onClick={() => (addingTo.value = 'action')}
                      class="border-2 border-dashed border-sketch-light/50 rounded p-4 text-sketch-light text-sm cursor-pointer hover:border-sketch-medium hover:text-sketch-medium hover:bg-white/20 transition-all duration-200"
                    >
                      <div class="text-center">
                        <span class="italic">Waiting for everyone to have filled the other columns first…</span>
                        <span class="block text-xs mt-2 opacity-60">Click to add an action anyway</span>
                      </div>
                    </div>
                  ) : (
                    <AddCard
                      sessionId={session.id}
                      type={col.type}
                      placeholder={col.placeholder}
                      addingTo={addingTo}
                      isDemo={isDemo}
                    />
                  )}
                  {columnCards.map(card => (
                    <CardItem
                      key={card.id}
                      card={card}
                      sessionId={session.id}
                      hasVoted={votedIds.has(card.id)}
                      animation={animating.value.get(card.id)}
                      isDemo={isDemo}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
