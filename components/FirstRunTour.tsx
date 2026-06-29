/** A one-time welcome card pointing at the features people miss. */

import { useEffect, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { ClockIcon, MoonIcon, SearchIcon, StashIcon, TabsIcon } from './icons';

const HINT = '⌘K / Ctrl K';

const FEATURES = [
  {
    icon: <SearchIcon />,
    title: 'Find any tab',
    body: `Press ${HINT} to search every open tab, stash, and saved page.`,
  },
  {
    icon: <StashIcon />,
    title: 'Stash, don’t lose',
    body: 'Save a group (or drag a tab) into a stash, then reopen it anytime — Undo has your back.',
  },
  {
    icon: <TabsIcon />,
    title: 'Workspaces',
    body: 'Switch between named tab contexts (work, research…) — your tabs are saved as you go.',
  },
  {
    icon: <MoonIcon />,
    title: 'Stay light',
    body: 'Suspend inactive tabs to free memory, and let Perch flag the ones you’ve forgotten.',
  },
];

export function FirstRunTour({ onDismiss }: { onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(true, ref);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  return (
    <div className="palette-overlay" onMouseDown={onDismiss}>
      <div
        ref={ref}
        className="tour-card"
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to Perch"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="tour-head">
          <ClockIcon className="tour-mark" />
          <h2>Welcome to Perch</h2>
          <p>A calm home for your tabs. Four things worth knowing:</p>
        </div>
        <ul className="tour-list">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <span className="tour-icon" aria-hidden="true">
                {f.icon}
              </span>
              <div>
                <div className="tour-title">{f.title}</div>
                <div className="tour-body">{f.body}</div>
              </div>
            </li>
          ))}
        </ul>
        <button className="tab-cleanup-btn tour-cta" onClick={onDismiss}>
          Get started
        </button>
      </div>
    </div>
  );
}
