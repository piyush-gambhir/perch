/** Cmd/Ctrl+K command palette — fuzzy search across open tabs, saved tabs, and
 *  stashed sessions; keyboard-driven jump / open / restore. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { faviconUrl } from '../utils/format';
import { SearchIcon } from './icons';

export interface PaletteItem {
  id: string;
  title: string;
  subtitle: string;
  kind: 'tab' | 'saved' | 'session' | 'history' | 'action';
  hostname?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: PaletteItem[];
}

const KIND_LABEL: Record<PaletteItem['kind'], string> = {
  tab: 'Open',
  saved: 'Saved',
  session: 'Stash',
  history: 'Recall',
  action: 'Action',
};

function scoreMatch(haystack: string, query: string): number {
  // Lower is better. -1 means no match.
  const h = haystack.toLowerCase();
  const idx = h.indexOf(query);
  if (idx !== -1) return idx;
  // subsequence fallback
  let qi = 0;
  for (let i = 0; i < h.length && qi < query.length; i++) {
    if (h[i] === query[qi]) qi++;
  }
  return qi === query.length ? 1000 : -1;
}

export function CommandPalette({ open, onClose, items }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, dialogRef);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 50);
    return items
      .map((item) => ({ item, score: scoreMatch(`${item.title} ${item.subtitle}`, q) }))
      .filter((r) => r.score !== -1)
      .sort((a, b) => a.score - b.score)
      .slice(0, 50)
      .map((r) => r.item);
  }, [items, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      // focus after paint
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[selected];
      if (item) {
        item.run();
        onClose();
      }
    }
  };

  return (
    <div className="palette-overlay" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search tabs"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="palette-search">
          <SearchIcon className="palette-search-icon" />
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Search tabs, saved, and stashes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="palette-kbd">esc</kbd>
        </div>
        <div className="palette-list" ref={listRef}>
          {results.length === 0 ? (
            <div className="palette-empty">No matches</div>
          ) : (
            results.map((item, i) => (
              <button
                key={item.id}
                className="palette-item"
                data-selected={i === selected}
                onMouseEnter={() => setSelected(i)}
                onClick={() => {
                  item.run();
                  onClose();
                }}
              >
                {item.hostname ? (
                  <img
                    className="palette-favicon"
                    src={faviconUrl(item.hostname)}
                    alt=""
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                    }}
                  />
                ) : (
                  <span className="palette-favicon" />
                )}
                <span className="palette-item-title">{item.title}</span>
                <span className="palette-item-sub">{item.subtitle}</span>
                <span className="palette-item-kind">{KIND_LABEL[item.kind]}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
