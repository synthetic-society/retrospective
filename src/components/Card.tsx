import { useState, useRef, useEffect } from 'preact/hooks';
import type { Signal } from '@preact/signals';
import type { Card, ColumnType } from '../lib/store';
import { useAddCard, useUpdateCard, useDeleteCard, useToggleVote } from '../lib/queries';
import { MAX_CARD_CONTENT_LENGTH } from '../lib/constants';
import VoteButton from './VoteButton';

const sanitizeInput = (text: string) => text.replace(/<[^>]*>/g, '').substring(0, MAX_CARD_CONTENT_LENGTH);

// Preserve cursor position when modifying contenteditable content
const sanitizeWithCursor = (el: HTMLElement) => {
  const text = el.textContent || '';
  const sanitized = sanitizeInput(text);
  if (text === sanitized) return sanitized;

  // Save cursor position
  const sel = window.getSelection();
  const offset = sel?.focusOffset ?? text.length;

  // Update content
  el.textContent = sanitized;

  // Restore cursor (clamped to new length)
  if (sel && el.firstChild) {
    const newOffset = Math.min(offset, sanitized.length);
    const range = document.createRange();
    range.setStart(el.firstChild, newOffset);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  return sanitized;
};

const handlePaste = (e: ClipboardEvent) => {
  e.preventDefault();
  document.execCommand('insertText', false, sanitizeInput(e.clipboardData?.getData('text/plain') || ''));
};

function useAutoSave(sessionId: string, isDemo = false) {
  const updateCard = useUpdateCard(sessionId, isDemo);
  const timeout = useRef<number>();
  return (cardId: string, value: string) => {
    clearTimeout(timeout.current);
    timeout.current = window.setTimeout(() => updateCard.mutate({ id: cardId, content: value }), 300);
  };
}

export function AddCard({
  sessionId,
  type,
  placeholder,
  addingTo,
  isDemo = false,
}: {
  sessionId: string;
  type: ColumnType;
  placeholder: string;
  addingTo: Signal<ColumnType | null>;
  isDemo?: boolean;
}) {
  const [content, setContent] = useState('');
  const inputRef = useRef<HTMLSpanElement>(null);
  const addCard = useAddCard(sessionId, isDemo);
  const isActive = addingTo.value === type;

  useEffect(() => {
    if (isActive) inputRef.current?.focus();
  }, [isActive]);

  const handleInput = (e: Event) => {
    const el = e.target as HTMLSpanElement;
    const sanitized = sanitizeWithCursor(el);
    setContent(sanitized);
  };

  const submit = async () => {
    if (!content.trim() || addCard.isPending) return;
    await addCard.mutateAsync({ columnType: type, content: content.trim() });
    setContent('');
    if (inputRef.current) inputRef.current.textContent = '';
    addingTo.value = null;
  };

  const close = () => {
    setContent('');
    if (inputRef.current) inputRef.current.textContent = '';
    addingTo.value = null;
  };

  if (!isActive) {
    return (
      <div
        onClick={() => (addingTo.value = type)}
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
        onPaste={handlePaste}
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
        <button onClick={close} disabled={addCard.isPending} class="btn-ghost btn-sm">
          Cancel
        </button>
        <button onClick={submit} disabled={addCard.isPending || !content.trim()} class="btn-primary btn-sm">
          {addCard.isPending ? '...' : 'Add'}
        </button>
      </div>
    </div>
  );
}

export function CardItem({
  card,
  sessionId,
  hasVoted,
  animation,
  isDemo = false,
}: {
  card: Card;
  sessionId: string;
  hasVoted: boolean;
  animation?: 'up' | 'down';
  isDemo?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(card.content);
  const [justVoted, setJustVoted] = useState(false);
  const editRef = useRef<HTMLSpanElement>(null);
  const deleteCard = useDeleteCard(sessionId, isDemo);
  const toggleVote = useToggleVote(sessionId, isDemo);
  const save = useAutoSave(sessionId, isDemo);

  useEffect(() => setContent(card.content), [card.content]);

  const handleVote = () => {
    setJustVoted(true);
    setTimeout(() => setJustVoted(false), 300);
    toggleVote.mutate(card.id);
  };
  const animClass =
    animation === 'up' ? 'card-move-up' : animation === 'down' ? 'card-move-down' : justVoted ? 'card-voted' : '';

  const handleChange = (e: Event) => {
    const el = e.target as HTMLSpanElement;
    const sanitized = sanitizeWithCursor(el);
    setContent(sanitized);
    save(card.id, sanitized);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setEditing(false);
    }
    if (e.key === 'Escape') {
      editRef.current && (editRef.current.textContent = card.content);
      setContent(card.content);
      setEditing(false);
    }
  };

  return (
    <div
      class={`min-h-16 group bg-white border-2 border-sketch-dark rounded p-3 hover:border-sketch-dark transition-colors relative hand-drawn cursor-text ${animClass}`}
      onClick={() => !editing && setEditing(true)}
    >
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
                if (!el.textContent) el.textContent = content;
                setTimeout(() => {
                  el.focus();
                  const r = document.createRange();
                  const s = window.getSelection();
                  r.selectNodeContents(el);
                  r.collapse(false);
                  s?.removeAllRanges();
                  s?.addRange(r);
                }, 0);
              }
            }}
            role="textbox"
            contenteditable
            onInput={handleChange}
            onPaste={handlePaste}
            onBlur={() => setEditing(false)}
            onKeyDown={handleKeyDown}
            class="block w-full bg-transparent text-sketch-dark text-sm outline-none leading-snug text-left"
          />
          <div class="flex justify-end gap-2 mt-2 clear-right">
            <button onMouseDown={e => (e.preventDefault(), setEditing(false))} class="btn-ghost btn-sm">
              cancel
            </button>
            <button
              onMouseDown={e => (e.preventDefault(), deleteCard.mutate(card.id))}
              disabled={deleteCard.isPending}
              class="btn-secondary btn-sm"
            >
              {deleteCard.isPending ? '...' : 'delete'}
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
