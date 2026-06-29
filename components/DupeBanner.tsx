/** Banner shown when more than one Perch new-tab page is open. */

import { DuplicateIcon } from './icons';

interface DupeBannerProps {
  count: number;
  onClose: () => void;
  onDismiss: () => void;
}

export function DupeBanner({ count, onClose, onDismiss }: DupeBannerProps) {
  return (
    <div
      className="tab-cleanup-banner"
      style={{ display: 'flex' }}
      role="region"
      aria-label="Duplicate Perch tabs"
    >
      <div className="tab-cleanup-left">
        <div className="tab-cleanup-icon" aria-hidden="true">
          <DuplicateIcon />
        </div>
        <div className="tab-cleanup-text">
          You have <strong>{count}</strong> Perch tabs open. Keep just this one?
        </div>
      </div>
      <div className="stale-actions">
        <button className="tab-cleanup-btn" onClick={onClose}>
          Close extras
        </button>
        <button className="banner-dismiss" aria-label="Dismiss" onClick={onDismiss}>
          ×
        </button>
      </div>
    </div>
  );
}
