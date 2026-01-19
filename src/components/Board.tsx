import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import { QueryClientProvider } from '@tanstack/react-query';
import type { Card, ColumnType, Session } from '../lib/store';
import { getSessionHistory } from '../lib/store';
import { createQueryClient, useCards, useVotes, useAddCard, useUpdateCard, useDeleteCard, useToggleVote } from '../lib/queries';
import { MAX_CARD_CONTENT_LENGTH } from '../lib/schemas';
import VoteButton from './VoteButton';

const COLUMNS: { type: ColumnType; title: string; placeholder: string }[] = [
  { type: 'glad', title: 'What went well', placeholder: "I'm glad that…" },
  { type: 'wondering', title: 'Questions', placeholder: "I'm wondering about…" },
  { type: 'sad', title: 'Opportunities', placeholder: "It wasn't so great that…" },
  { type: 'action', title: 'Actions', placeholder: 'We should…' },
];

const sanitizeInput = (text: string) => text.replace(/<[^>]*>/g, '').substring(0, MAX_CARD_CONTENT_LENGTH);

const handlePaste = (e: ClipboardEvent) => {
  e.preventDefault();
  document.execCommand('insertText', false, sanitizeInput(e.clipboardData?.getData('text/plain') || ''));
};

function useAutoSave(sessionId: string) {
  const updateCard = useUpdateCard(sessionId);
  const timeout = useRef<number>();
  return useCallback((cardId: string, value: string) => {
    clearTimeout(timeout.current);
    timeout.current = window.setTimeout(() => updateCard.mutate({ id: cardId, content: value }), 300);
  }, [updateCard]);
}

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

  // Load actual session name from localStorage
  const [session, setSession] = useState<Session>(initialSession);
  useEffect(() => {
    const stored = getSessionHistory().find(s => s.id === initialSession.id);
    if (stored) setSession(stored);
  }, [initialSession.id]);

  const { data: cards = [], isLoading } = useCards(session.id);
  const { data: votedIds = new Set<string>() } = useVotes(session.id);

  // Animation tracking
  const prevPositions = useRef<Map<string, { column: ColumnType; index: number }>>(new Map());
  const [animating, setAnimating] = useState<Map<string, 'up' | 'down'>>(new Map());

  const getPositions = useCallback((list: Card[]) => {
    const pos = new Map<string, { column: ColumnType; index: number }>();
    COLUMNS.forEach(col => {
      list.filter(c => c.column_type === col.type)
        .sort((a, b) => b.votes - a.votes)
        .forEach((card, i) => pos.set(card.id, { column: col.type, index: i }));
    });
    return pos;
  }, []);

  useEffect(() => {
    if (!cards.length) return;
    const newPos = getPositions(cards);
    const anims = new Map<string, 'up' | 'down'>();
    newPos.forEach((np, id) => {
      const op = prevPositions.current.get(id);
      if (op?.column === np.column) {
        if (np.index < op.index) anims.set(id, 'up');
        else if (np.index > op.index) anims.set(id, 'down');
      }
    });
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
    if (!audioRef.current) {
      audioRef.current = new Audio('/kimiko-ishizaka-open-goldberg-variations-26.ogg');
      audioRef.current.loop = true;
    }
    isPlaying ? audioRef.current.pause() : audioRef.current.play().catch(console.error);
    setIsPlaying(!isPlaying);
  };

  const getColumnCards = (type: ColumnType) =>
    cards.filter(c => c.column_type === type).sort((a, b) => b.votes - a.votes);

  if (isLoading) {
    return <div class="min-h-screen flex items-center justify-center"><div class="text-sketch-dark hand-drawn">~ Loading ~</div></div>;
  }

  return (
    <div class="min-h-screen flex flex-col">
      <header class="border-b-2 border-sketch-dark bg-white/40 p-3 flex items-center justify-between hand-drawn">
        <a href="/" class="text-sketch-medium hover:text-sketch-dark transition-colors text-sm">← Back</a>
        <h1 class="text-sketch-dark font-medium truncate mx-4 hand-drawn">{session.name}</h1>
        <div class="flex gap-2">
          <button onClick={toggleMusic} class="btn-primary btn-sm hand-drawn" title={isPlaying ? 'Pause' : 'Play'}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="15 10 70 70" class="w-4 h-4 inline-block" fill="currentColor">
              <path d="m35 14c-1.0625 0.23828-1.9766 1.0977-2 2v49.094c-2.1289-1.9141-4.9297-3.0938-8-3.0938-6.6055 0-12 5.3945-12 12s5.3945 12 12 12 12-5.3945 12-12v-40h46v25.094c-2.1289-1.9141-4.9297-3.0938-8-3.0938-6.6055 0-12 5.3945-12 12s5.3945 12 12 12 12-5.3945 12-12v-52c0-1.0469-0.95312-2-2-2z"/>
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
              <button onClick={() => setExpandedColumn(isExpanded ? null : col.type)} class="md:hidden w-full p-3 flex items-center justify-between bg-white/60 border-l-4 border-b-2 border-sketch-dark hand-drawn cursor-pointer hover:bg-white transition-all mx-2 my-2">
                <div class="flex items-center gap-2">
                  <span class="text-sketch-dark">{isExpanded ? '▼' : '►'}</span>
                  <span class="text-sketch-dark uppercase tracking-widest text-sm font-semibold hand-drawn">{col.title} ({columnCards.length})</span>
                </div>
              </button>
              <div class={`${isExpanded ? 'block' : 'hidden'} md:flex md:flex-col column bg-white/60`}>
                <div class="hidden md:flex p-3 border-b-2 border-sketch-dark items-center justify-between hand-drawn">
                  <h2 class="text-sketch-dark uppercase tracking-widest text-sm font-semibold hand-drawn">{col.title}</h2>
                </div>
                <div class="flex-1 overflow-y-auto p-2 space-y-2">
                  <AddCard sessionId={session.id} type={col.type} placeholder={col.placeholder} addingTo={addingTo} setAddingTo={setAddingTo} />
                  {columnCards.map(card => (
                    <CardItem key={card.id} card={card} sessionId={session.id} hasVoted={votedIds.has(card.id)} animation={animating.get(card.id)} />
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

function AddCard({ sessionId, type, placeholder, addingTo, setAddingTo }: {
  sessionId: string; type: ColumnType; placeholder: string; addingTo: ColumnType | null; setAddingTo: (v: ColumnType | null) => void;
}) {
  const [content, setContent] = useState('');
  const inputRef = useRef<HTMLSpanElement>(null);
  const addCard = useAddCard(sessionId);
  const isActive = addingTo === type;

  useEffect(() => { if (isActive) inputRef.current?.focus(); }, [isActive]);

  const handleInput = (e: Event) => {
    const el = e.target as HTMLSpanElement;
    const sanitized = sanitizeInput(el.textContent || '');
    if (el.textContent !== sanitized) el.textContent = sanitized;
    setContent(sanitized);
  };

  const submit = async () => {
    if (!content.trim() || addCard.isPending) return;
    await addCard.mutateAsync({ columnType: type, content: content.trim() });
    setContent('');
    if (inputRef.current) inputRef.current.textContent = '';
    setAddingTo(null);
  };

  const close = () => { setContent(''); if (inputRef.current) inputRef.current.textContent = ''; setAddingTo(null); };

  if (!isActive) {
    return (
      <div onClick={() => setAddingTo(type)} class="border-2 border-dashed border-sketch-medium rounded p-4 text-sketch-medium italic text-sm hand-drawn cursor-pointer hover:border-sketch-dark hover:text-sketch-dark hover:bg-white/40 transition-all">
        {placeholder}
      </div>
    );
  }

  return (
    <div class="bg-white border-2 border-sketch-dark rounded p-2 hand-drawn">
      <span ref={inputRef} role="textbox" contenteditable onInput={handleInput} onPaste={handlePaste}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } if (e.key === 'Escape') close(); }}
        class="block w-full bg-transparent text-sketch-dark text-sm outline-none leading-tight" style="min-height: 1.5rem;" />
      <div class="flex justify-end gap-2 mt-2">
        <button onClick={close} disabled={addCard.isPending} class="btn-ghost btn-sm">Cancel</button>
        <button onClick={submit} disabled={addCard.isPending || !content.trim()} class="btn-primary btn-sm">{addCard.isPending ? '...' : 'Add'}</button>
      </div>
    </div>
  );
}

function CardItem({ card, sessionId, hasVoted, animation }: { card: Card; sessionId: string; hasVoted: boolean; animation?: 'up' | 'down'; }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(card.content);
  const [justVoted, setJustVoted] = useState(false);
  const editRef = useRef<HTMLSpanElement>(null);
  const deleteCard = useDeleteCard(sessionId);
  const toggleVote = useToggleVote(sessionId);
  const save = useAutoSave(sessionId);

  useEffect(() => { setContent(card.content); }, [card.content]);

  const handleVote = () => { setJustVoted(true); setTimeout(() => setJustVoted(false), 300); toggleVote.mutate(card.id); };
  const animClass = animation === 'up' ? 'card-move-up' : animation === 'down' ? 'card-move-down' : justVoted ? 'card-voted' : '';

  const handleChange = (e: Event) => {
    const el = e.target as HTMLSpanElement;
    const sanitized = sanitizeInput(el.textContent || '');
    if (el.textContent !== sanitized) el.textContent = sanitized;
    setContent(sanitized);
    save(card.id, sanitized);
  };

  return (
    <div class={`min-h-16 group bg-white border-2 border-sketch-dark rounded p-3 hover:border-sketch-dark transition-colors relative hand-drawn cursor-text ${animClass}`} onClick={() => !editing && setEditing(true)}>
      <div class="float-right ml-2 mb-2" style="shape-outside: circle(50%); width: 44px; height: 44px;" onClick={e => e.stopPropagation()}>
        <VoteButton votes={card.votes} hasVoted={hasVoted} onClick={handleVote} />
      </div>
      {editing ? (
        <div onClick={e => e.stopPropagation()} style="direction: ltr;">
          <span ref={el => {
            editRef.current = el;
            if (el && editing) {
              if (!el.textContent) el.textContent = content;
              setTimeout(() => { el.focus(); const r = document.createRange(); const s = window.getSelection(); r.selectNodeContents(el); r.collapse(false); s?.removeAllRanges(); s?.addRange(r); }, 0);
            }
          }} role="textbox" contenteditable onInput={handleChange} onPaste={handlePaste} onBlur={() => setEditing(false)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setEditing(false); } if (e.key === 'Escape') { editRef.current && (editRef.current.textContent = card.content); setContent(card.content); setEditing(false); } }}
            class="block w-full bg-transparent text-sketch-dark text-sm outline-none leading-snug text-left" />
          <div class="flex justify-end gap-2 mt-2 clear-right">
            <button onMouseDown={e => { e.preventDefault(); setEditing(false); }} class="btn-ghost btn-sm">cancel</button>
            <button onMouseDown={e => { e.preventDefault(); deleteCard.mutate(card.id); }} disabled={deleteCard.isPending} class="btn-secondary btn-sm">{deleteCard.isPending ? '...' : 'delete'}</button>
          </div>
        </div>
      ) : (
        <div class="text-sketch-dark text-sm leading-snug text-left" style="direction: ltr;">{card.content}</div>
      )}
    </div>
  );
}
