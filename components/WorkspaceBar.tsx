/** Workspace switcher — pills for each tab context; click to switch, double-click (or
 *  the hover pencil) to rename, hover-x to delete (non-active). */

import { useState } from 'react';
import type { Workspace } from '../utils/types';
import { PencilIcon, PlusIcon } from './icons';

interface WorkspaceBarProps {
  workspaces: Workspace[];
  activeId: string | null;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function WorkspaceBar({
  workspaces,
  activeId,
  onSwitch,
  onCreate,
  onRename,
  onDelete,
}: WorkspaceBarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const commit = (id: string) => {
    if (draft.trim()) onRename(id, draft.trim());
    setEditingId(null);
  };

  const startRename = (id: string, name: string) => {
    setEditingId(id);
    setDraft(name);
  };

  return (
    <div className="workspace-bar" aria-label="Workspaces">
      {workspaces.map((w) => {
        const active = w.id === activeId;
        return (
          <div key={w.id} className={`ws-pill${active ? ' active' : ''}`}>
            {editingId === w.id ? (
              <input
                className="ws-rename"
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commit(w.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit(w.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
              />
            ) : (
              <button
                className="ws-name"
                aria-pressed={active}
                onClick={() => !active && onSwitch(w.id)}
                onDoubleClick={() => startRename(w.id, w.name)}
                title={
                  active ? `${w.name} (current, double-click to rename)` : `Switch to ${w.name}`
                }
              >
                {w.name}
                {w.tabs.length > 0 && <span className="ws-count">{w.tabs.length}</span>}
              </button>
            )}
            {editingId !== w.id && (
              <button
                className="ws-edit"
                aria-label={`Rename ${w.name}`}
                title="Rename workspace"
                onClick={() => startRename(w.id, w.name)}
              >
                <PencilIcon />
              </button>
            )}
            {!active && workspaces.length > 1 && (
              <button
                className="ws-del"
                aria-label={`Delete ${w.name}`}
                title="Delete workspace"
                onClick={() => onDelete(w.id)}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <button
        className="ws-add"
        aria-label="New workspace"
        title="New workspace"
        onClick={onCreate}
      >
        <PlusIcon />
      </button>
    </div>
  );
}
