import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import type { Card, ColumnType, Session, Store } from '../lib/store';
import { createStore, addToSessionHistory, getClientId, getSession } from '../lib/store';
import { MAX_CARD_CONTENT_LENGTH } from '../lib/schemas';
import VoteButton from './VoteButton';

interface BoardProps {
  session: Session;
}

const COLUMNS: { type: ColumnType; title: string; placeholder: string }[] = [
  { type: 'glad', title: 'What went well', placeholder: "I'm glad that…" },
  { type: 'wondering', title: 'Questions', placeholder: "I'm wondering about…" },
  { type: 'sad', title: 'Opportunities', placeholder: "It wasn't so great that…" },
  { type: 'action', title: 'Actions', placeholder: 'We should…' },
];

// Custom hook for auto-save with refs to prevent stale closures
function useAutoSave(cardId: string, store: Store | null) {
  const saveTimeout = useRef<number>();
  const latestStore = useRef(store);
  const latestCardId = useRef(cardId);

  // Keep refs updated
  useEffect(() => {
    latestStore.current = store;
    latestCardId.current = cardId;
  }, [store, cardId]);

  return useCallback((value: string) => {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = window.setTimeout(async () => {
      if (!latestStore.current) return;
      try {
        await latestStore.current.updateCard(latestCardId.current, value);
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, 300);
  }, []); // No dependencies - uses refs
}

// Helper to strip HTML and enforce max length
const sanitizeInput = (text: string): string => {
  // Strip any HTML tags
  const stripped = text.replace(/<[^>]*>/g, '');
  // Enforce max length
  return stripped.substring(0, MAX_CARD_CONTENT_LENGTH);
};

// Handle paste to strip formatting
const handlePaste = (e: ClipboardEvent, setContent: (v: string) => void) => {
  e.preventDefault();
  const text = e.clipboardData?.getData('text/plain') || '';
  const sanitized = sanitizeInput(text);
  document.execCommand('insertText', false, sanitized);
};

export default function Board({ session: initialSession }: BoardProps) {
  const [session, setSession] = useState<Session>(initialSession);
  const [store, setStore] = useState<Store | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [addingTo, setAddingTo] = useState<ColumnType | null>(null);
  const [expandedColumn, setExpandedColumn] = useState<ColumnType | null>('glad');
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clientId = useRef(getClientId());

  // Track card positions for animation
  const prevPositions = useRef<Map<string, { column: ColumnType; index: number }>>(new Map());
  const [animatingCards, setAnimatingCards] = useState<Map<string, 'up' | 'down' | 'voted'>>(
    new Map()
  );

  // Calculate positions and detect changes
  const getCardPositions = useCallback((cardList: Card[]) => {
    const positions = new Map<string, { column: ColumnType; index: number }>();
    for (const col of COLUMNS) {
      const columnCards = cardList
        .filter(c => c.column_type === col.type)
        .sort((a, b) => b.votes - a.votes);
      columnCards.forEach((card, index) => {
        positions.set(card.id, { column: col.type, index });
      });
    }
    return positions;
  }, []);

  // Detect position changes and trigger animations
  useEffect(() => {
    if (cards.length === 0) return;

    const newPositions = getCardPositions(cards);
    const animations = new Map<string, 'up' | 'down' | 'voted'>();

    newPositions.forEach((newPos, cardId) => {
      const oldPos = prevPositions.current.get(cardId);
      if (oldPos && oldPos.column === newPos.column) {
        if (newPos.index < oldPos.index) {
          animations.set(cardId, 'up');
        } else if (newPos.index > oldPos.index) {
          animations.set(cardId, 'down');
        }
      }
    });

    if (animations.size > 0) {
      setAnimatingCards(animations);
      // Clear animations after they complete
      setTimeout(() => setAnimatingCards(new Map()), 400);
    }

    prevPositions.current = newPositions;
  }, [cards, getCardPositions]);

  // Initialize store and load data
  useEffect(() => {
    const init = async () => {
      const fetchedSession = await getSession(initialSession.id);
      if (fetchedSession) {
        setSession(fetchedSession);
        addToSessionHistory(fetchedSession);
      }

      const s = createStore(initialSession.id, clientId.current);
      setStore(s);
      await s.load();
      setCards(s.cards);
      setVotedIds(s.votedCardIds);
      setLoading(false);

      return s.subscribe(() => {
        setCards([...s.cards]);
        setVotedIds(new Set(s.votedCardIds));
      });
    };

    let unsubscribe: (() => void) | undefined;
    init().then(unsub => {
      unsubscribe = unsub;
    });
    return () => unsubscribe?.();
  }, [initialSession.id]);

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMusicToggle = () => {
    if (!audioRef.current) {
      // Lazy load audio
      audioRef.current = new Audio('/kimiko-ishizaka-open-goldberg-variations-26.ogg');
      audioRef.current.loop = true;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(error => {
        console.error('Audio playback failed:', error);
      });
      setIsPlaying(true);
    }
  };

  const getColumnCards = (type: ColumnType) =>
    cards.filter(c => c.column_type === type).sort((a, b) => b.votes - a.votes);

  if (loading) {
    return (
      <div class="min-h-screen flex items-center justify-center">
        <div class="text-sketch-dark hand-drawn">~ Loading ~</div>
      </div>
    );
  }

  return (
    <div class="min-h-screen flex flex-col">
      {/* Header */}
      <header class="border-b-2 border-sketch-dark bg-white/40 p-3 flex items-center justify-between hand-drawn">
        <a href="/" class="text-sketch-medium hover:text-sketch-dark transition-colors text-sm">
          ← Back
        </a>
        <h1 class="text-sketch-dark font-medium truncate mx-4 hand-drawn">{session.name}</h1>
        <div class="flex gap-2">
          <button
            onClick={handleMusicToggle}
            class="text-sm border-2 border-sketch-dark text-sketch-dark px-2 py-1 rounded hover:bg-sketch-dark hover:text-beige-light transition-all hand-drawn cursor-pointer"
            title={isPlaying ? 'Pause music' : 'Play music'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="15 10 70 70"
              class="w-4 h-4 inline-block"
              fill="currentColor"
            >
              <path d="m35 14c-1.0625 0.23828-1.9766 1.0977-2 2v49.094c-2.1289-1.9141-4.9297-3.0938-8-3.0938-6.6055 0-12 5.3945-12 12s5.3945 12 12 12 12-5.3945 12-12v-40h46v25.094c-2.1289-1.9141-4.9297-3.0938-8-3.0938-6.6055 0-12 5.3945-12 12s5.3945 12 12 12 12-5.3945 12-12v-52c0-1.0469-0.95312-2-2-2z"/>
            </svg>
          </button>
          <button
            onClick={handleShare}
            class="text-sm border-2 border-sketch-dark text-sketch-dark px-3 py-1 rounded hover:bg-sketch-dark hover:text-beige-light transition-all hand-drawn cursor-pointer"
          >
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>
      </header>

      {/* Responsive columns */}
      <div class="flex-1 md:grid md:grid-cols-4 md:gap-4 md:p-4 overflow-y-auto">
        {COLUMNS.map(col => {
          const columnCards = getColumnCards(col.type);
          const isExpanded = expandedColumn === col.type;

          return (
            <div key={col.type}>
              {/* Mobile header */}
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

              {/* Column content */}
              <div
                class={`${
                  isExpanded ? 'block' : 'hidden'
                } md:flex md:flex-col column bg-white/60 md:bg-white/60`}
              >
                {/* Desktop header */}
                <div class="hidden md:flex p-3 border-b-2 border-sketch-dark items-center justify-between hand-drawn">
                  <h2 class="text-sketch-dark uppercase tracking-widest text-sm font-semibold hand-drawn">
                    {col.title}
                  </h2>
                </div>

                {/* Cards container */}
                <div class="flex-1 overflow-y-auto p-2 space-y-2">
                  <AddCard
                    type={col.type}
                    placeholder={col.placeholder}
                    store={store}
                    addingTo={addingTo}
                    setAddingTo={setAddingTo}
                  />
                  {columnCards.map(card => (
                    <CardItem
                      key={card.id}
                      card={card}
                      hasVoted={votedIds.has(card.id)}
                      store={store}
                      animation={animatingCards.get(card.id)}
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

// Add Card Component (placeholder + form)
interface AddCardProps {
  type: ColumnType;
  placeholder: string;
  store: Store | null;
  addingTo: ColumnType | null;
  setAddingTo: (v: ColumnType | null) => void;
}

function AddCard({ type, placeholder, store, addingTo, setAddingTo }: AddCardProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLSpanElement>(null);
  const isActive = addingTo === type;

  useEffect(() => {
    if (isActive) inputRef.current?.focus();
  }, [isActive]);

  const handleInput = (e: Event) => {
    const text = (e.target as HTMLSpanElement).textContent || '';
    const sanitized = sanitizeInput(text);
    if (text !== sanitized) {
      (e.target as HTMLSpanElement).textContent = sanitized;
    }
    setContent(sanitized);
  };

  const submit = async () => {
    if (!store || !content.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await store.addCard(type, content.trim());
      setContent('');
      setAddingTo(null);
    } catch (error) {
      console.error('Failed to add card:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const close = () => {
    setContent('');
    setAddingTo(null);
  };

  if (!isActive) {
    return (
      <div
        onClick={() => setAddingTo(type)}
        class="border-2 border-dashed border-sketch-medium rounded p-4 text-sketch-medium italic text-sm hand-drawn cursor-pointer hover:border-sketch-dark hover:text-sketch-dark hover:bg-white/40 transition-all"
      >
        {placeholder}
      </div>
    );
  }

  return (
    <div class="bg-white border-2 border-sketch-dark rounded p-2 hand-drawn">
      <span
        ref={inputRef}
        role="textbox"
        contenteditable
        onInput={handleInput}
        onPaste={e => handlePaste(e as unknown as ClipboardEvent, setContent)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
          if (e.key === 'Escape') close();
        }}
        class="block w-full bg-transparent text-sketch-dark text-sm outline-none leading-tight"
        style="min-height: 1.5rem;"
      />
      <div class="flex justify-end gap-2 mt-2">
        <button onClick={close} disabled={isSubmitting} class="btn-ghost btn-sm">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={isSubmitting || !content.trim()}
          class="btn-primary btn-sm"
        >
          {isSubmitting ? '...' : 'Add'}
        </button>
      </div>
    </div>
  );
}

// Card Item
interface CardItemProps {
  card: Card;
  hasVoted: boolean;
  store: Store | null;
  animation?: 'up' | 'down' | 'voted';
}

function CardItem({ card, hasVoted, store, animation }: CardItemProps) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(card.content);
  const [isDeleting, setIsDeleting] = useState(false);
  const [justVoted, setJustVoted] = useState(false);
  const editRef = useRef<HTMLSpanElement>(null);
  const debouncedSave = useAutoSave(card.id, store);

  useEffect(() => {
    setContent(card.content);
  }, [card.content]);

  const handleVote = async () => {
    setJustVoted(true);
    setTimeout(() => setJustVoted(false), 300);
    await store?.toggleVote(card.id);
  };

  // Determine animation class
  const animationClass =
    animation === 'up'
      ? 'card-move-up'
      : animation === 'down'
        ? 'card-move-down'
        : justVoted
          ? 'card-voted'
          : '';

  const handleChange = (e: Event) => {
    const text = (e.target as HTMLSpanElement).textContent || '';
    const sanitized = sanitizeInput(text);
    if (text !== sanitized) {
      (e.target as HTMLSpanElement).textContent = sanitized;
    }
    setContent(sanitized);
    debouncedSave(sanitized);
  };

  const handleDelete = async () => {
    if (store && !isDeleting) {
      setIsDeleting(true);
      try {
        await store.deleteCard(card.id);
      } catch (error) {
        console.error('Failed to delete card:', error);
        setIsDeleting(false);
      }
    }
  };

  return (
    <div
      class={`min-h-16 group bg-white border-2 border-sketch-dark rounded p-3 hover:border-sketch-dark transition-colors relative hand-drawn cursor-text ${animationClass}`}
      onClick={() => !editing && setEditing(true)}
    >
      {/* Floating heart with shape for text wrapping */}
      <div
        class="float-right ml-2 mb-2"
        style="shape-outside: circle(50%); width: 44px; height: 44px;"
        onClick={e => e.stopPropagation()}
      >
        <VoteButton votes={card.votes} hasVoted={hasVoted} onClick={handleVote} />
      </div>

      {editing ? (
        <div onClick={e => e.stopPropagation()} style="direction: ltr;">
          <span
            ref={el => {
              editRef.current = el;
              if (el && editing) {
                // Set textContent safely (no XSS) instead of dangerouslySetInnerHTML
                if (!el.textContent) el.textContent = content;
                setTimeout(() => {
                  el.focus();
                  const range = document.createRange();
                  const sel = window.getSelection();
                  range.selectNodeContents(el);
                  range.collapse(false);
                  sel?.removeAllRanges();
                  sel?.addRange(range);
                }, 0);
              }
            }}
            role="textbox"
            contenteditable
            onInput={handleChange}
            onPaste={e => handlePaste(e as unknown as ClipboardEvent, setContent)}
            onBlur={() => setEditing(false)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setEditing(false);
              }
              if (e.key === 'Escape') {
                if (editRef.current) editRef.current.textContent = card.content;
                setContent(card.content);
                setEditing(false);
              }
            }}
            class="block w-full bg-transparent text-sketch-dark text-sm outline-none leading-snug text-left"
          />
          <div class="flex justify-end gap-2 mt-2 clear-right">
            <button
              onMouseDown={e => {
                e.preventDefault();
                setEditing(false);
              }}
              class="btn-ghost btn-sm"
            >
              cancel
            </button>
            <button
              onMouseDown={e => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              class="btn-secondary btn-sm"
            >
              {isDeleting ? '...' : 'delete'}
            </button>
          </div>
        </div>
      ) : (
        <div class="text-sketch-dark text-sm leading-snug text-left" style="direction: ltr;">
          {card.content}
        </div>
      )}
    </div>
  );
}
