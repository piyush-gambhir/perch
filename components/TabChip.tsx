/** One tab "chip" inside a domain card: favicon, title, dupe badge, save/close. */

import { useState } from 'react';
import { setDragTab } from '../utils/dnd';
import { displayTitle, faviconUrl } from '../utils/format';
import type { TabInfo } from '../utils/types';
import { BookmarkIcon, CloseIcon } from './icons';

interface TabChipProps {
  tab: TabInfo;
  domain: string;
  count: number;
  onFocus: (url: string) => void;
  onSave: (tab: { url: string; title: string }) => void;
  onClose: (url: string) => void;
}

export function TabChip({ tab, domain, count, onFocus, onSave, onClose }: TabChipProps) {
  const [leaving, setLeaving] = useState(false);

  let label = displayTitle(tab.title || '', tab.url, domain);
  let hostname = '';
  try {
    const parsed = new URL(tab.url);
    hostname = parsed.hostname;
    if (parsed.hostname === 'localhost' && parsed.port) label = `${parsed.port} ${label}`;
  } catch {
    /* ignore */
  }

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLeaving(true);
    setTimeout(() => onClose(tab.url), 200);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLeaving(true);
    setTimeout(() => onSave({ url: tab.url, title: label }), 200);
  };

  return (
    <div
      className={`page-chip clickable${count > 1 ? ' chip-has-dupes' : ''}`}
      title={label}
      draggable
      onDragStart={(e) => setDragTab(e.dataTransfer, { url: tab.url, title: label })}
      onClick={() => onFocus(tab.url)}
      style={
        leaving
          ? { opacity: 0, transform: 'scale(0.8)', transition: 'opacity 0.2s, transform 0.2s' }
          : undefined
      }
    >
      {hostname && (
        <img
          className="chip-favicon"
          src={faviconUrl(hostname)}
          alt=""
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      <span className="chip-text">{label}</span>
      {count > 1 && <span className="chip-dupe-badge">({count}x)</span>}
      <div className="chip-actions">
        <button className="chip-action chip-save" title="Save for later" onClick={handleSave}>
          <BookmarkIcon />
        </button>
        <button className="chip-action chip-close" title="Close this tab" onClick={handleClose}>
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}
