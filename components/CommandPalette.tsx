/** Cmd/Ctrl+K command palette — fuzzy search across open tabs, saved tabs, and
 *  stashed sessions; keyboard-driven jump / open / restore. */

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { faviconFor } from '../utils/tabs';
import { SearchIcon } from './icons';

export interface PaletteItem {
  id: string;
  title: string;
  subtitle: string;
  kind: 'tab' | 'saved' | 'session' | 'workspace' | 'history' | 'action';
  hostname?: string;
  /** The page this item opens, used for its favicon. */
  url?: string;
  /** The live tab's own cached favicon, when this item is an open tab. */
  favIconUrl?: string;
  searchText?: string;
  timestamp?: number;
  run: () => void | Promise<void>;
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
  workspace: 'Workspace',
  history: 'Recall',
  action: 'Action',
};
const PALETTE_OPENED_AT = Date.now();

/** The item's local favicon, or the blank placeholder when there is none. */
function PaletteFavicon({ item }: { item: PaletteItem }) {
  const src = item.url ? faviconFor(item.url, item.favIconUrl) : '';
  if (!src) return <span className="palette-favicon" />;
  return (
    <img
      className="palette-favicon"
      src={src}
      alt=""
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
      }}
    />
  );
}

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
  const overlayMouseDownRef = useRef(false);
  useFocusTrap(open, dialogRef);

  const LIST_ID = 'palette-results';
  const optionId = (i: number) => `palette-option-${i}`;

  // Async item.run() handlers can reject; swallow so a failure doesn't surface as an
  // unhandled rejection (the palette closes regardless).
  const runItem = (item: PaletteItem) => {
    void Promise.resolve(item.run()).catch(() => {});
  };

  const results = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const kindFilters: Record<string, PaletteItem['kind']> = {
      'open:': 'tab',
      'saved:': 'saved',
      'stash:': 'session',
      'workspace:': 'workspace',
    };
    const kindToken = tokens.find((token) => token in kindFilters);
    const olderToken = tokens.find((token) => token.startsWith('older:'));
    const olderDays = olderToken ? Number(olderToken.slice(6).replace(/d$/, '')) : 0;
    const q = tokens
      .filter((token) => !(token in kindFilters) && !token.startsWith('older:'))
      .join(' ');
    const filtered = items.filter((item) => {
      if (kindToken && item.kind !== kindFilters[kindToken]) return false;
      if (
        olderDays > 0 &&
        (!item.timestamp || PALETTE_OPENED_AT - item.timestamp < olderDays * 86_400_000)
      )
        return false;
      return true;
    });
    if (!q) return filtered.slice(0, 50);
    return filtered
      .map((item) => ({
        item,
        score: scoreMatch(`${item.title} ${item.subtitle} ${item.searchText ?? ''}`, q),
      }))
      .filter((r) => r.score !== -1)
      .sort((a, b) => a.score - b.score)
      .slice(0, 50)
      .map((r) => r.item);
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const initialQuery = new URLSearchParams(location.search).get('q') ?? '';
      setQuery(initialQuery);
      setSelected(0);
      inputRef.current?.focus();
      if (initialQuery) history.replaceState(null, '', location.pathname);
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

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
        runItem(item);
        onClose();
      }
    }
  };

  const handleOverlayMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    overlayMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleOverlayMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    if (overlayMouseDownRef.current && e.target === e.currentTarget) onClose();
    overlayMouseDownRef.current = false;
  };

  return (
    <div
      className="palette-overlay"
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
    >
      <div
        ref={dialogRef}
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search tabs"
        onKeyDown={onKeyDown}
      >
        <div className="palette-search">
          <SearchIcon className="palette-search-icon" />
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Search tabs, saved, and stashes…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={LIST_ID}
            aria-activedescendant={results.length > 0 ? optionId(selected) : undefined}
            aria-autocomplete="list"
          />
          <kbd className="palette-kbd">esc</kbd>
        </div>
        <div className="sr-only" aria-live="polite">
          {results.length} result{results.length !== 1 ? 's' : ''}
        </div>
        <div className="palette-list" ref={listRef} id={LIST_ID} role="listbox">
          {results.length === 0 ? (
            <div className="palette-empty">No matches</div>
          ) : (
            results.map((item, i) => (
              <button
                key={item.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === selected}
                className="palette-item"
                data-selected={i === selected}
                onMouseEnter={() => setSelected(i)}
                onClick={() => {
                  runItem(item);
                  onClose();
                }}
              >
                <PaletteFavicon item={item} />
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
