import { signal } from '@preact/signals';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'preact/hooks';
import { useFocusTrap } from '../lib/focus-trap';
import { createQueryClient, useCards, useSession, useVotes } from '../lib/queries';
import type { Card, ColumnType, Session } from '../lib/store';
import { AddCard, CardItem } from './Card';
import ErrorBoundary from './ErrorBoundary';

const COLUMNS: { type: ColumnType; title: string; placeholder: string }[] = [
  { type: 'glad', title: 'What went well', placeholder: "I'm glad that…" },
  { type: 'wondering', title: 'Questions', placeholder: "I'm wondering about…" },
  { type: 'sad', title: 'Opportunities', placeholder: "It wasn't so great that…" },
  { type: 'action', title: 'Actions', placeholder: 'We should…' },
];

export default function Board({ session, isDemo = false }: { session: Session; isDemo?: boolean }) {
  const qc = useRef(createQueryClient());
  return (
    <ErrorBoundary>
      <QueryClientProvider client={qc.current}>
        <BoardContent session={session} isDemo={isDemo} />
      </QueryClientProvider>
    </ErrorBoundary>
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
      COLUMNS.flatMap((col) =>
        list
          .filter((c) => c.column_type === col.type)
          .sort((a, b) => b.votes - a.votes)
          .map((card, i) => [card.id, { column: col.type, index: i }] as const),
      ),
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
      }),
    );
    if (anims.size) {
      animating.value = anims;
      setTimeout(() => {
        animating.value = new Map();
      }, 400);
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

  // Live region: announce card count changes from polling
  const prevCardCount = useRef<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (prevCardCount.current === null) {
      prevCardCount.current = cards.length;
      return;
    }
    const diff = cards.length - prevCardCount.current;
    prevCardCount.current = cards.length;
    if (diff > 0) {
      setAnnouncement(`${diff} new card${diff > 1 ? 's' : ''} added`);
    } else if (diff < 0) {
      setAnnouncement(`${Math.abs(diff)} card${Math.abs(diff) > 1 ? 's' : ''} removed`);
    }
    if (diff !== 0) {
      const t = setTimeout(() => setAnnouncement(''), 3000);
      return () => clearTimeout(t);
    }
  }, [cards.length]);

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  };

  const toggleMusic = () => {
    audioRef.current ??= Object.assign(new Audio('/kimiko-ishizaka-open-goldberg-variations-26.ogg'), { loop: true });
    isPlaying.value ? audioRef.current.pause() : audioRef.current.play().catch(console.error);
    isPlaying.value = !isPlaying.value;
  };

  const fullscreenTrapRef = useFocusTrap(fullscreenColumn.value !== null);

  const getColumnCards = (type: ColumnType) =>
    cards.filter((c) => c.column_type === type).sort((a, b) => b.votes - a.votes);

  if (isLoading) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: preact doesn't support <output> element
      <div role="status" class="min-h-screen flex items-center justify-center" aria-busy="true">
        <div class="text-sketch-dark">~ Loading ~</div>
        <span class="sr-only">Loading board</span>
      </div>
    );
  }

  const fullscreenCol = fullscreenColumn.value ? COLUMNS.find((c) => c.type === fullscreenColumn.value) : null;
  const fullscreenCards = fullscreenColumn.value ? getColumnCards(fullscreenColumn.value) : [];

  return (
    <div class="min-h-screen flex flex-col">
      {/* Fullscreen overlay */}
      {fullscreenCol && (
        <div
          ref={fullscreenTrapRef}
          class="fixed inset-0 z-50 overflow-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fullscreen-dialog-title"
        >
          {/* Backdrop - click to close */}
          <button
            type="button"
            tabIndex={-1}
            class="absolute inset-0 w-full h-full bg-beige-light/95 cursor-default"
            onClick={() => {
              fullscreenColumn.value = null;
            }}
            aria-label="Close fullscreen overlay"
          />
          {/* Content */}
          <div class="relative z-10">
            <div class="sticky top-0 z-10 bg-beige-light p-4 flex items-center justify-between doodly-border-b">
              <h2 id="fullscreen-dialog-title" class="text-sketch-dark uppercase tracking-widest text-lg font-semibold">
                {fullscreenCol.title} ({fullscreenCards.length})
              </h2>
              <button
                type="button"
                onClick={() => {
                  fullscreenColumn.value = null;
                }}
                class="btn-primary btn-sm"
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
            <div class="p-6">
              {fullscreenCards.length === 0 ? (
                <p class="text-center text-sketch-medium italic py-12">No cards in this column yet</p>
              ) : (
                <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 list-none p-0 m-0">
                  {fullscreenCards.map((card) => (
                    <li key={card.id}>
                      <CardItem
                        card={card}
                        sessionId={session.id}
                        hasVoted={votedIds.has(card.id)}
                        animation={animating.value.get(card.id)}
                        isDemo={isDemo}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <header class="bg-white/40 p-3 flex items-center justify-between doodly-border-b">
        <nav aria-label="Board navigation">
          <a href="/" class="text-sketch-medium hover:text-sketch-dark transition-colors text-sm">
            <span aria-hidden="true">← </span>Back
          </a>
        </nav>
        <h1 class="text-sketch-dark font-medium truncate mx-4">{session.name}</h1>
        <div class="flex gap-2">
          <button
            type="button"
            onClick={toggleMusic}
            class="btn-primary btn-md"
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
            type="button"
            onClick={handleShare}
            class="btn-primary btn-md"
            aria-label={copied.value ? 'Link copied to clipboard' : 'Copy share link to clipboard'}
            aria-live="polite"
          >
            {copied.value ? 'Copied!' : 'Share'}
          </button>
        </div>
      </header>

      <div class="flex-1 md:grid md:grid-cols-4 md:gap-4 md:p-4 overflow-y-auto">
        {COLUMNS.map((col) => {
          const columnCards = getColumnCards(col.type);
          const isExpanded = expandedColumn.value === col.type;
          return (
            <section key={col.type} aria-labelledby={`heading-${col.type}`}>
              <h2 id={`heading-${col.type}`} class="sr-only">
                {col.title}
              </h2>
              <button
                type="button"
                onClick={() => {
                  expandedColumn.value = isExpanded ? null : col.type;
                }}
                aria-expanded={isExpanded}
                aria-controls={`column-${col.type}`}
                class="md:hidden w-full p-3 flex items-center justify-between bg-white/60 doodly-border cursor-pointer hover:bg-white transition-all mx-2 my-2"
              >
                <div class="flex items-center gap-2">
                  <span class="text-sketch-dark" aria-hidden="true">
                    {isExpanded ? '▼' : '►'}
                  </span>
                  <span class="text-sketch-dark uppercase tracking-widest text-sm font-semibold">
                    {col.title} ({columnCards.length})
                  </span>
                </div>
              </button>
              <div
                id={`column-${col.type}`}
                class={`${isExpanded ? 'block' : 'hidden'} md:flex md:flex-col column bg-white/60`}
              >
                <div class="hidden md:flex p-3 border-b-2 border-sketch-dark items-center justify-between">
                  <span class="text-sketch-dark uppercase tracking-widest text-sm font-semibold" aria-hidden="true">
                    {col.title}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
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
                    <button
                      type="button"
                      onClick={() => {
                        addingTo.value = 'action';
                      }}
                      class="w-full border-2 border-dashed border-sketch-light/50 rounded p-4 text-sketch-light text-sm cursor-pointer hover:border-sketch-medium hover:text-sketch-medium hover:bg-white/20 transition-all duration-200"
                    >
                      <div class="text-center">
                        <span class="italic">Waiting for everyone to have filled the other columns first…</span>
                        <span class="block text-xs mt-2 text-sketch-medium">Click to add an action anyway</span>
                      </div>
                    </button>
                  ) : (
                    <AddCard
                      sessionId={session.id}
                      type={col.type}
                      placeholder={col.placeholder}
                      addingTo={addingTo}
                      isDemo={isDemo}
                    />
                  )}
                  <ul class="space-y-2 list-none p-0 m-0">
                    {columnCards.map((card) => (
                      <li key={card.id}>
                        <CardItem
                          card={card}
                          sessionId={session.id}
                          hasVoted={votedIds.has(card.id)}
                          animation={animating.value.get(card.id)}
                          isDemo={isDemo}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          );
        })}
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: div with role="status" used because Preact doesn't support <output> */}
      <div role="status" class="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}
