import { useEffect, useRef } from 'preact/hooks';

const FOCUSABLE =
  ':is(a[href], button:not([disabled]), textarea, input, select, [tabindex], [contenteditable]):not([tabindex="-1"])';

export function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);
  const wasActive = useRef(false);

  if (active && !wasActive.current) previousFocus.current = document.activeElement;
  wasActive.current = active;

  useEffect(() => {
    const el = containerRef.current;
    if (!active || !el) return;

    el.querySelectorAll<HTMLElement>(FOCUSABLE)[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = el.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!items.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      (previousFocus.current as HTMLElement)?.focus?.();
    };
  }, [active]);

  return containerRef;
}
