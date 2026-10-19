/** Right column: "Saved for Later" checklist + collapsible searchable archive. */

import { useMemo, useState } from 'react';
import { getDragTab, type DragTab } from '../utils/dnd';
import { faviconUrl, hostOf, safeHref, timeAgo } from '../utils/format';
import type { DeferredTab } from '../utils/types';
import { ChevronIcon, CloseIcon } from './icons';

interface SavedForLaterProps {
  active: DeferredTab[];
  archived: DeferredTab[];
  onCheck: (id: string) => void;
  onDismiss: (id: string) => void;
  onDropSave: (tab: DragTab) => void;
  onMeta: (id: string, tags: string[], note: string) => void;
}

export function SavedForLater({
  active,
  archived,
  onCheck,
  onDismiss,
  onDropSave,
  onMeta,
}: SavedForLaterProps) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropOver, setDropOver] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [tagsDraft, setTagsDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');

  const filteredArchive = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return archived;
    return archived.filter(
      (item) =>
        (item.title || '').toLowerCase().includes(q) || (item.url || '').toLowerCase().includes(q),
    );
  }, [archived, query]);

  return (
    <div
      className={`deferred-column${dropOver ? ' drop-over' : ''}`}
      style={{ display: 'block' }}
      onDragOver={(e) => {
        e.preventDefault();
        setDropOver(true);
      }}
      onDragLeave={() => setDropOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropOver(false);
        const tab = getDragTab(e.dataTransfer);
        if (tab) onDropSave(tab);
      }}
    >
      <div className="section-header">
        <h2>Saved for later</h2>
        <div className="section-line"></div>
        <div className="section-count">
          {active.length > 0 ? `${active.length} item${active.length !== 1 ? 's' : ''}` : ''}
        </div>
      </div>
      <p className="panel-subtitle">Your reading list.</p>

      {active.length > 0 ? (
        <div className="deferred-list">
          {active.map((item) => {
            const domain = hostOf(item.url);
            return (
              <div key={item.id} className="deferred-item">
                <input
                  type="checkbox"
                  className="deferred-checkbox"
                  onChange={() => onCheck(item.id)}
                />
                <div className="deferred-info">
                  <a
                    href={safeHref(item.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="deferred-title"
                    title={item.title}
                  >
                    <img
                      src={faviconUrl(domain)}
                      alt=""
                      style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 4 }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    {item.title || item.url}
                  </a>
                  <div className="deferred-meta">
                    <span>{domain}</span>
                    <span>{timeAgo(item.savedAt)}</span>
                  </div>
                </div>
                <button
                  className="deferred-dismiss"
                  title="Tags and note"
                  aria-label={`Edit tags and note for ${item.title || item.url}`}
                  onClick={() => {
                    setDetailsId(detailsId === item.id ? null : item.id);
                    setTagsDraft((item.tags ?? []).join(', '));
                    setNoteDraft(item.note ?? '');
                  }}
                >
                  #
                </button>
                <button
                  className="deferred-dismiss"
                  title="Dismiss"
                  aria-label={`Dismiss ${item.title || item.url}`}
                  onClick={() => onDismiss(item.id)}
                >
                  <CloseIcon />
                </button>
                {detailsId === item.id && (
                  <div className="session-details deferred-details">
                    <input
                      value={tagsDraft}
                      onChange={(event) => setTagsDraft(event.target.value)}
                      placeholder="Tags, comma separated"
                    />
                    <textarea
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      placeholder="Add a note"
                    />
                    <button
                      className="action-btn"
                      onClick={() => {
                        onMeta(
                          item.id,
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
            );
          })}
        </div>
      ) : (
        <div className="deferred-empty" style={{ display: 'block' }}>
          Nothing saved. Living in the moment.
        </div>
      )}

      {archived.length > 0 && (
        <div className="deferred-archive" style={{ display: 'block' }}>
          <button
            className={`archive-toggle${archiveOpen ? ' open' : ''}`}
            onClick={() => setArchiveOpen((v) => !v)}
          >
            <ChevronIcon className="archive-chevron" />
            Archive
            <span className="archive-count">({archived.length})</span>
          </button>
          {archiveOpen && (
            <div className="archive-body" style={{ display: 'block' }}>
              <input
                type="text"
                className="archive-search"
                placeholder="Search archived tabs..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="archive-list">
                {filteredArchive.length > 0 ? (
                  filteredArchive.map((item) => (
                    <div key={item.id} className="archive-item">
                      <a
                        href={safeHref(item.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="archive-item-title"
                        title={item.title}
                      >
                        {item.title || item.url}
                      </a>
                      <span className="archive-item-date">
                        {timeAgo(item.completedAt || item.savedAt)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>
                    No results
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
