/** Proactive nudge: surfaces tabs untouched for 7+ days with bulk stash/close. */

import { STALE_DAYS } from '../utils/stale';
import { ClockIcon } from './icons';

interface StaleBannerProps {
  count: number;
  onStash: () => void;
  onClose: () => void;
  onDismiss: () => void;
}

export function StaleBanner({ count, onStash, onClose, onDismiss }: StaleBannerProps) {
  return (
    <div className="tab-cleanup-banner stale-banner">
      <div className="tab-cleanup-left">
        <div className="tab-cleanup-icon">
          <ClockIcon />
        </div>
        <div className="tab-cleanup-text">
          <strong>{count}</strong> tab{count !== 1 ? 's' : ''} untouched for {STALE_DAYS}+ days.
        </div>
      </div>
      <div className="stale-actions">
        <button className="action-btn" onClick={onStash}>
          Stash them
        </button>
        <button className="tab-cleanup-btn" onClick={onClose}>
          Close them
        </button>
        <button className="banner-dismiss" title="Dismiss" onClick={onDismiss}>
          ×
        </button>
      </div>
    </div>
  );
}
