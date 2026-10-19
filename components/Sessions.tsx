/** Sidebar panel: stashed sessions — restore, rename, reorder, drop tabs in. */

import { useState } from 'react';
import { getDragSession, getDragTab, setDragSession, type DragTab } from '../utils/dnd';
import { timeAgo } from '../utils/format';
import type { Session } from '../utils/types';
import { NewWindowIcon, PencilIcon, RestoreIcon, StashIcon, TrashIcon } from './icons';

interface SessionsProps {
  sessions: Session[];
  onRestore: (id: string) => void;
  onRestoreNewWindow: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onMeta: (id: string, tags: string[], note: string) => void;
  onReorder: (draggedId: string, targetId: string) => void;
  onDropToSession: (id: string, tab: DragTab) => void;
  onCreateStashFromDrop: (tab: DragTab) => void;
}

export function Sessions({
  sessions,
  onRestore,
  onRestoreNewWindow,
  onRename,
  onDelete,
  onMeta,
  onReorder,
  onDropToSession,
  onCreateStashFromDrop,
}: SessionsProps) {
  const [overId, setOverId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [tagsDraft, setTagsDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');

  const commitRename = (id: string) => {
    if (draft.trim()) onRename(id, draft.trim());
    setEditingId(null);
  };

  const startRename = (id: string, name: string) => {
    setEditingId(id);
    setDraft(name);
  };

  return (
    <div className="side-card">
      <div className="section-header">
        <h2>Stashed</h2>
        <div className="section-line"></div>
        <div className="section-count">{sessions.length}</div>
      </div>
      <p className="panel-subtitle">Tucked away and closed — restore anytime.</p>

      {sessions.length === 0 && (
        <div className="deferred-empty">
          Nothing stashed yet. Stash a group to clear your plate — it&apos;ll wait here.
        </div>
      )}

      <div className="session-list">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`session-item${overId === s.id ? ' drop-over' : ''}`}
            draggable={editingId !== s.id}
            onDragStart={(e) => setDragSession(e.dataTransfer, s.id)}
            onDragOver={(e) => {
              e.preventDefault();
              setOverId(s.id);
            }}
            onDragLeave={() => setOverId((v) => (v === s.id ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              setOverId(null);
              const tab = getDragTab(e.dataTransfer);
              if (tab) {
                onDropToSession(s.id, tab);
                return;
              }
              const draggedSession = getDragSession(e.dataTransfer);
              if (draggedSession && draggedSession !== s.id) onReorder(draggedSession, s.id);
            }}
          >
            <div className="session-icon">
              <StashIcon />
            </div>
            <div className="session-info">
              {editingId === s.id ? (
                <input
                  className="session-rename"
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(s.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <div className="session-name-row">
                  <div
                    className="session-name"
                    title="Click to rename"
                    onClick={() => startRename(s.id, s.name)}
                  >
                    {s.name}
                  </div>
                  <button
                    className="name-edit-btn"
                    aria-label={`Rename ${s.name}`}
                    title="Rename"
                    onClick={() => startRename(s.id, s.name)}
                  >
                    <PencilIcon />
                  </button>
                </div>
              )}
              <div className="session-meta">
                <span>
                  {s.tabs.length} tab{s.tabs.length !== 1 ? 's' : ''}
                </span>
                <span>{timeAgo(s.createdAt)}</span>
              </div>
            </div>
            <button
              className="session-action"
              title="Tags and note"
              aria-label={`Edit tags and note for ${s.name}`}
              onClick={() => {
                setDetailsId(detailsId === s.id ? null : s.id);
                setTagsDraft((s.tags ?? []).join(', '));
                setNoteDraft(s.note ?? '');
              }}
            >
              #
            </button>
            <button
              className="session-action"
              title="Restore tabs"
              aria-label={`Restore ${s.name}`}
              onClick={() => onRestore(s.id)}
            >
              <RestoreIcon />
            </button>
            <button
              className="session-action"
              title="Restore in a new window"
              aria-label={`Restore ${s.name} in a new window`}
              onClick={() => onRestoreNewWindow(s.id)}
            >
              <NewWindowIcon />
            </button>
            <button
              className="session-action danger"
              title="Delete stash"
              aria-label={`Delete ${s.name}`}
              onClick={() => onDelete(s.id)}
            >
              <TrashIcon />
            </button>
            {detailsId === s.id && (
              <div className="session-details">
                <input
                  value={tagsDraft}
                  onChange={(event) => setTagsDraft(event.target.value)}
                  placeholder="Tags, comma separated"
                  aria-label={`Tags for ${s.name}`}
                />
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="Add a note"
                  aria-label={`Note for ${s.name}`}
                />
                <button
                  className="action-btn"
                  onClick={() => {
                    onMeta(
                      s.id,
                      tagsDraft
                        .split(',')
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                      noteDraft.trim(),
                    );
                    setDetailsId(null);
                  }}
                >
                  Save details
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        className={`session-dropzone${overId === '__new__' ? ' drop-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOverId('__new__');
        }}
        onDragLeave={() => setOverId((v) => (v === '__new__' ? null : v))}
        onDrop={(e) => {
          e.preventDefault();
          setOverId(null);
          const tab = getDragTab(e.dataTransfer);
          if (tab) onCreateStashFromDrop(tab);
        }}
      >
        <StashIcon />
        Drag a tab here to stash it
      </div>
    </div>
  );
}
