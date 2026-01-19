import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Card, ColumnType, Session } from '../lib/store';
import { getSessionHistory } from '../lib/store';
import { createQueryClient, useCards, useVotes } from '../lib/queries';
import { AddCard, CardItem } from './Card';

const COLUMNS: { type: ColumnType; title: string; placeholder: string }[] = [
  { type: 'glad', title: 'What went well', placeholder: "I'm glad that…" },
  { type: 'wondering', title: 'Questions', placeholder: "I'm wondering about…" },
  { type: 'sad', title: 'Opportunities', placeholder: "It wasn't so great that…" },
  { type: 'action', title: 'Actions', placeholder: 'We should…' },
];

export default function Board({ session }: { session: Session }) {
  const qc = useRef(createQueryClient());
  return (
    <QueryClientProvider client={qc.current}>
      <BoardContent session={session} />
    </QueryClientProvider>
  );
}

function BoardContent({ session: initialSession }: { session: Session }) {
  const [expandedColumn, setExpandedColumn] = useState<ColumnType | null>('glad');
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [addingTo, setAddingTo] = useState<ColumnType | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [session, setSession] = useState(initialSession);
  useEffect(() => {
    const stored = getSessionHistory().find(s => s.id === initialSession.id);
    if (stored) setSession(stored);
  }, [initialSession.id]);

  const { data: cards = [], isLoading } = useCards(session.id);
  const { data: votedIds = new Set<string>() } = useVotes(session.id);

  const prevPositions = useRef(new Map<string, { column: ColumnType; index: number }>());
  const [animating, setAnimating] = useState(new Map<string, 'up' | 'down'>());

  const getPositions = useCallback(
    (list: Card[]) =>
      new Map(
        COLUMNS.flatMap(col =>
          list
            .filter(c => c.column_type === col.type)
            .sort((a, b) => b.votes - a.votes)
            .map((card, i) => [card.id, { column: col.type, index: i }] as const)
        )
      ),
    []
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
      setAnimating(anims);
      setTimeout(() => setAnimating(new Map()), 400);
    }
    prevPositions.current = newPos;
  }, [cards, getPositions]);

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleMusic = () => {
    audioRef.current ??= Object.assign(new Audio('/kimiko-ishizaka-open-goldberg-variations-26.ogg'), { loop: true });
    isPlaying ? audioRef.current.pause() : audioRef.current.play().catch(console.error);
    setIsPlaying(!isPlaying);
  };

  const getColumnCards = (type: ColumnType) =>
    cards.filter(c => c.column_type === type).sort((a, b) => b.votes - a.votes);

  if (isLoading) {
    return (
      <div class="min-h-screen flex items-center justify-center">
        <div class="text-sketch-dark hand-drawn">~ Loading ~</div>
      </div>
    );
  }

  return (
    <div class="min-h-screen flex flex-col">
      <header class="border-b-2 border-sketch-dark bg-white/40 p-3 flex items-center justify-between hand-drawn">
        <a href="/" class="text-sketch-medium hover:text-sketch-dark transition-colors text-sm">
          ← Back
        </a>
        <h1 class="text-sketch-dark font-medium truncate mx-4 hand-drawn">{session.name}</h1>
        <div class="flex gap-2">
          <button onClick={toggleMusic} class="btn-primary btn-sm hand-drawn" title={isPlaying ? 'Pause' : 'Play'}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="15 10 70 70"
              class="w-4 h-4 inline-block"
              fill="currentColor"
            >
              <path d="m35 14c-1.0625 0.23828-1.9766 1.0977-2 2v49.094c-2.1289-1.9141-4.9297-3.0938-8-3.0938-6.6055 0-12 5.3945-12 12s5.3945 12 12 12 12-5.3945 12-12v-40h46v25.094c-2.1289-1.9141-4.9297-3.0938-8-3.0938-6.6055 0-12 5.3945-12 12s5.3945 12 12 12 12-5.3945 12-12v-52c0-1.0469-0.95312-2-2-2z" />
            </svg>
          </button>
          <button onClick={handleShare} class="btn-primary btn-sm hand-drawn">
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </header>

      <div class="flex-1 md:grid md:grid-cols-4 md:gap-4 md:p-4 overflow-y-auto">
        {COLUMNS.map(col => {
          const columnCards = getColumnCards(col.type);
          const isExpanded = expandedColumn === col.type;
          return (
            <div key={col.type}>
              <button
                onClick={() => setExpandedColumn(isExpanded ? null : col.type)}
                class="md:hidden w-full p-3 flex items-center justify-between bg-white/60 border-l-4 border-b-2 border-sketch-dark hand-drawn cursor-pointer hover:bg-white transition-all mx-2 my-2"
              >
                <div class="flex items-center gap-2">
                  <span class="text-sketch-dark">{isExpanded ? '▼' : '►'}</span>
                  <span class="text-sketch-dark uppercase tracking-widest text-sm font-semibold hand-drawn">
                    {col.title} ({columnCards.length})
                  </span>
                </div>
              </button>
              <div class={`${isExpanded ? 'block' : 'hidden'} md:flex md:flex-col column bg-white/60`}>
                <div class="hidden md:flex p-3 border-b-2 border-sketch-dark items-center justify-between hand-drawn">
                  <h2 class="text-sketch-dark uppercase tracking-widest text-sm font-semibold hand-drawn">
                    {col.title}
                  </h2>
                </div>
                <div class="flex-1 overflow-y-auto p-2 space-y-2">
                  <AddCard
                    sessionId={session.id}
                    type={col.type}
                    placeholder={col.placeholder}
                    addingTo={addingTo}
                    setAddingTo={setAddingTo}
                  />
                  {columnCards.map(card => (
                    <CardItem
                      key={card.id}
                      card={card}
                      sessionId={session.id}
                      hasVoted={votedIds.has(card.id)}
                      animation={animating.get(card.id)}
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
