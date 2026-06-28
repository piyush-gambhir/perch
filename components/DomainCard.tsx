/** One domain group rendered as a card: title, tab/dupe badges, chips, actions. */

import { useState } from 'react';
import { friendlyDomain } from '../utils/format';
import { duplicateInfo, uniqueByUrl } from '../utils/grouping';
import { tabGroupColor } from '../utils/tabs';
import type { DomainGroup } from '../utils/types';
import { LANDING_PAGES_KEY } from '../utils/types';
import { CloseIcon, StashIcon, TabsIcon } from './icons';
import { TabChip } from './TabChip';

const VISIBLE_LIMIT = 8;

interface DomainCardProps {
  group: DomainGroup;
  onCloseGroup: (group: DomainGroup) => void;
  onStashGroup: (group: DomainGroup) => void;
  onDedup: (urls: string[]) => void;
  onFocus: (url: string) => void;
  onSave: (tab: { url: string; title: string }) => void;
  onCloseTab: (url: string) => void;
  onGroupInBrowser: (group: DomainGroup) => void;
  onUngroup: (group: DomainGroup) => void;
}

export function DomainCard({
  group,
  onCloseGroup,
  onStashGroup,
  onDedup,
  onFocus,
  onSave,
  onCloseTab,
  onGroupInBrowser,
  onUngroup,
}: DomainCardProps) {
  const [closing, setClosing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const tabs = group.tabs || [];
  const tabCount = tabs.length;
  const isLanding = group.domain === LANDING_PAGES_KEY;
  const isNative = group.groupId !== undefined && group.groupId >= 0;
  const isCustom = !!group.label && !isNative;
  const canGroupInBrowser = !isLanding && !isNative && !isCustom && group.domain !== 'local-files';
  const { urlCounts, dupeUrls, hasDupes, totalExtras } = duplicateInfo(tabs);

  const uniqueTabs = uniqueByUrl(tabs);
  const visibleTabs = expanded ? uniqueTabs : uniqueTabs.slice(0, VISIBLE_LIMIT);
  const extraCount = uniqueTabs.length - Math.min(uniqueTabs.length, VISIBLE_LIMIT);

  const title = isLanding ? 'Homepages' : group.label || friendlyDomain(group.domain);

  const handleCloseGroup = () => {
    setClosing(true);
    setTimeout(() => onCloseGroup(group), 300);
  };

  const handleDedup = () => {
    onDedup(dupeUrls);
  };

  return (
    <div className={`mission-card domain-card${closing ? ' closing' : ''}`}>
      <div className="mission-content">
        <div className="mission-top">
          {isNative && (
            <span
              className="group-dot"
              style={{ background: tabGroupColor(group.color) }}
              aria-hidden="true"
            />
          )}
          <span className="mission-name">{title}</span>
          <span className="open-tabs-badge">
            <TabsIcon />
            {tabCount}
          </span>
          {hasDupes && (
            <span className="open-tabs-badge badge-dupe">
              {totalExtras} dupe{totalExtras !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="mission-pages">
          {visibleTabs.map((tab) => (
            <TabChip
              key={tab.id ?? tab.url}
              tab={tab}
              domain={group.domain}
              count={urlCounts[tab.url] || 1}
              onFocus={onFocus}
              onSave={onSave}
              onClose={onCloseTab}
            />
          ))}
          {!expanded && extraCount > 0 && (
            <div
              className="page-chip page-chip-overflow clickable"
              onClick={() => setExpanded(true)}
            >
              <span className="chip-text">+{extraCount} more</span>
            </div>
          )}
        </div>

        <div className="actions">
          <button
            className="action-btn"
            onClick={() => onStashGroup(group)}
            title="Save these tabs and close them"
          >
            <StashIcon />
            Stash
          </button>
          <button className="action-btn close-tabs" onClick={handleCloseGroup}>
            <CloseIcon />
            Close {tabCount}
          </button>
          {hasDupes && (
            <button className="action-btn" onClick={handleDedup}>
              Close {totalExtras} duplicate{totalExtras !== 1 ? 's' : ''}
            </button>
          )}
          {canGroupInBrowser && (
            <button
              className="action-btn"
              onClick={() => onGroupInBrowser(group)}
              title="Create a Chrome tab group from these tabs"
            >
              Group in browser
            </button>
          )}
          {isNative && (
            <button className="action-btn" onClick={() => onUngroup(group)}>
              Ungroup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
