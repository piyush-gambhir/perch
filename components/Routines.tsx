/** Sidebar panel: routines — reusable named tab sets you open on demand. */

import { useState } from 'react';
import { timeAgo } from '../utils/format';
import type { Routine } from '../utils/types';
import { ArrowRightIcon, ClockIcon, NewWindowIcon, PlusIcon, TrashIcon } from './icons';

interface RoutinesProps {
  routines: Routine[];
  canCreate: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onOpenNewWindow: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function Routines({
  routines,
  canCreate,
  onCreate,
  onOpen,
  onOpenNewWindow,
  onRename,
  onDelete,
}: RoutinesProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const commit = (id: string) => {
    if (draft.trim()) onRename(id, draft.trim());
    setEditingId(null);
  };

  if (routines.length === 0 && !canCreate) return null;

  return (
    <div className="side-card">
      <div className="section-header">
        <h2>Routines</h2>
        <div className="section-line"></div>
        <button
          className="icon-btn"
          title="Save current tabs as a routine"
          aria-label="Save current tabs as a routine"
          onClick={onCreate}
        >
          <PlusIcon />
        </button>
      </div>

      {routines.length === 0 ? (
        <div className="deferred-empty">Save your open tabs as a routine to reopen anytime.</div>
      ) : (
        <div className="session-list">
          {routines.map((r) => (
            <div key={r.id} className="session-item">
              <div className="session-icon">
                <ClockIcon />
              </div>
              <div className="session-info">
                {editingId === r.id ? (
                  <input
                    className="session-rename"
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commit(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commit(r.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <div
                    className="session-name"
                    title="Click to rename"
                    onClick={() => {
                      setEditingId(r.id);
                      setDraft(r.name);
                    }}
                  >
                    {r.name}
                  </div>
                )}
                <div className="session-meta">
                  <span>
                    {r.tabs.length} tab{r.tabs.length !== 1 ? 's' : ''}
                  </span>
                  <span>{timeAgo(r.createdAt)}</span>
                </div>
              </div>
              <button className="session-action" title="Open routine" onClick={() => onOpen(r.id)}>
                <ArrowRightIcon />
              </button>
              <button
                className="session-action"
                title="Open in a new window"
                onClick={() => onOpenNewWindow(r.id)}
              >
                <NewWindowIcon />
              </button>
              <button
                className="session-action danger"
                title="Delete routine"
                onClick={() => onDelete(r.id)}
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
