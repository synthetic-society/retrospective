import type { Signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { MAX_CARD_CONTENT_LENGTH } from '../lib/constants';
import { useAddCard, useDeleteCard, useToggleVote, useUpdateCard } from '../lib/queries';
import type { Card, ColumnType } from '../lib/store';
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
      <button
        type="button"
        onClick={() => {
          addingTo.value = type;
        }}
        class="w-full text-left rounded p-4 text-sketch-medium italic text-sm doodly-border-dashed cursor-pointer hover:text-sketch-dark hover:bg-white/40 transition-all"
      >
        {placeholder}
      </button>
    );
  }

  return (
    <div class="bg-white rounded p-2 doodly-border will-change-contents">
      {/* biome-ignore lint/a11y/useSemanticElements: contenteditable span is intentional for inline editing */}
      <span
        ref={inputRef}
        role="textbox"
        tabIndex={0}
        aria-label="Card content"
        aria-describedby={`card-char-limit-${type}`}
        contenteditable
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          }
          if (e.key === 'Escape') close();
        }}
        class="block w-full bg-transparent text-sketch-dark text-sm outline-none leading-tight min-h-input"
      />
      <span id={`card-char-limit-${type}`} class="sr-only">
        Maximum {MAX_CARD_CONTENT_LENGTH} characters
      </span>
      <div class="flex justify-end gap-2 mt-2">
        <button type="button" onClick={close} disabled={addCard.isPending} class="btn-ghost btn-sm">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={addCard.isPending || !content.trim()}
          class="btn-primary btn-sm"
        >
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
      if (editRef.current) {
        editRef.current.textContent = card.content;
      }
      setContent(card.content);
      setEditing(false);
    }
  };

  return (
    <div
      class={`min-h-16 group bg-white rounded p-3 transition-colors relative ${animClass} ${editing ? 'border-2 border-sketch-dark' : 'doodly-border'}`}
    >
      <div class="float-right ml-2 mb-2 size-vote-wrapper">
        <VoteButton votes={card.votes} hasVoted={hasVoted} onClick={handleVote} />
      </div>
      {editing ? (
        <div class="dir-ltr">
          {/* biome-ignore lint/a11y/useSemanticElements: contenteditable span is intentional for inline editing */}
          <span
            ref={(el) => {
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
            tabIndex={0}
            aria-label="Edit card content"
            contenteditable
            onInput={handleChange}
            onPaste={handlePaste}
            onBlur={() => setEditing(false)}
            onKeyDown={handleKeyDown}
            class="block w-full bg-transparent text-sketch-dark text-sm outline-none leading-snug text-left"
          />
          <div class="flex justify-end gap-2 mt-2 clear-right">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setEditing(false);
              }}
              class="btn-ghost btn-sm"
            >
              cancel
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                deleteCard.mutate(card.id);
              }}
              disabled={deleteCard.isPending}
              class="btn-secondary btn-sm"
            >
              {deleteCard.isPending ? '...' : 'delete'}
            </button>
          </div>
        </div>
      ) : (
        // biome-ignore lint/a11y/useSemanticElements: div with role="button" for click-to-edit behavior
        <div
          role="button"
          tabIndex={0}
          aria-label={`Edit card: ${card.content}`}
          class="text-sketch-dark text-sm leading-snug text-left dir-ltr cursor-text"
          onClick={() => setEditing(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setEditing(true);
            }
          }}
        >
          {card.content}
        </div>
      )}
    </div>
  );
}
