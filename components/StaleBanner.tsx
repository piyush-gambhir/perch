/** Proactive nudge: surfaces tabs untouched past the configured threshold. */

import { ClockIcon } from './icons';

interface StaleBannerProps {
  count: number;
  days: number;
  onStash: () => void;
  onClose: () => void;
  onDismiss: () => void;
}

export function StaleBanner({ count, days, onStash, onClose, onDismiss }: StaleBannerProps) {
  return (
    <div className="tab-cleanup-banner stale-banner" role="region" aria-label="Stale tabs">
      <div className="tab-cleanup-left">
        <div className="tab-cleanup-icon" aria-hidden="true">
          <ClockIcon />
        </div>
        <div className="tab-cleanup-text">
          <strong>{count}</strong> tab{count !== 1 ? 's' : ''} untouched for {days}+ days.
        </div>
      </div>
      <div className="stale-actions">
        <button className="action-btn" onClick={onStash}>
          Stash them
        </button>
        <button className="tab-cleanup-btn" onClick={onClose}>
          Close them
        </button>
        <button className="banner-dismiss" title="Dismiss" aria-label="Dismiss" onClick={onDismiss}>
          ×
        </button>
      </div>
    </div>
  );
}
