import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { browser } from 'wxt/browser';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  addAutomationRule,
  deleteAutomationRule,
  getAutomationRules,
  onAutomationRulesChanged,
  updateAutomationRule,
} from '../utils/automation';
import { analyzeTabHealth, stripTrackingParams } from '../utils/health';
import {
  captureSnapshot,
  deleteSnapshot,
  getSnapshots,
  onSnapshotsChanged,
  restoreSnapshot,
} from '../utils/snapshots';
import { pushClosed } from '../utils/sessions';
import { closeDuplicateTabs, suspendInactiveTabs } from '../utils/tabs';
import type { AutomationAction, AutomationRule, Snapshot, TabInfo } from '../utils/types';
import { ChevronIcon } from './icons';
import { useToast } from './Toast';

/** Snapshots listed before "Show all"; every retained one stays reachable. */
const SNAPSHOT_PREVIEW = 8;

interface Props {
  open: boolean;
  tabs: TabInfo[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export function ControlCenter({ open, tabs, onClose, onRefresh }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const overlayDown = useRef(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [showAllSnapshots, setShowAllSnapshots] = useState(false);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [hostname, setHostname] = useState('');
  const [days, setDays] = useState(7);
  const [action, setAction] = useState<AutomationAction>('stash');
  const toast = useToast();
  useFocusTrap(open, ref);

  const refreshData = async () => {
    const [nextSnapshots, nextRules] = await Promise.all([getSnapshots(), getAutomationRules()]);
    setSnapshots(nextSnapshots);
    setRules(nextRules);
  };
  useEffect(() => {
    if (!open) return;
    const initial = setTimeout(refreshData, 0);
    const unsubSnapshots = onSnapshotsChanged(refreshData);
    const unsubRules = onAutomationRulesChanged(refreshData);
    return () => {
      clearTimeout(initial);
      unsubSnapshots();
      unsubRules();
    };
  }, [open]);

  const health = useMemo(() => analyzeTabHealth(tabs), [tabs]);
  if (!open) return null;

  const createRule = async () => {
    await addAutomationRule({
      name: hostname ? `${hostname} cleanup` : 'Tab cleanup',
      enabled: true,
      hostname: hostname.trim(),
      olderThanDays: days,
      action,
      excludePinned: true,
    });
    setHostname('');
    toast('Automation rule added');
  };

  const cleanTracking = async () => {
    for (const tab of health.tracking) {
      if (tab.id !== undefined)
        await browser.tabs.update(tab.id, { url: stripTrackingParams(tab.url) });
    }
    toast(
      `Cleaned ${health.tracking.length} tracking URL${health.tracking.length === 1 ? '' : 's'}`,
    );
    await onRefresh();
  };

  const visibleSnapshots = showAllSnapshots ? snapshots : snapshots.slice(0, SNAPSHOT_PREVIEW);
  const totalSnapshotTabs = (snapshot: Snapshot) =>
    snapshot.windows.reduce((total, window) => total + window.tabs.length, 0);

  const down = (event: MouseEvent<HTMLDivElement>) => {
    overlayDown.current = event.target === event.currentTarget;
  };
  const up = (event: MouseEvent<HTMLDivElement>) => {
    if (overlayDown.current && event.target === event.currentTarget) onClose();
    overlayDown.current = false;
  };

  return (
    <div className="palette-overlay" onMouseDown={down} onMouseUp={up}>
      <div
        ref={ref}
        className="control-center"
        role="dialog"
        aria-modal="true"
        aria-label="Perch control center"
      >
        <div className="settings-head">
          <div>
            <h2>Control center</h2>
            <p className="panel-subtitle">Recovery, health and automation</p>
          </div>
          <button className="banner-dismiss" aria-label="Close control center" onClick={onClose}>
            ×
          </button>
        </div>

        <section className="control-section">
          <div className="section-header">
            <h3>Recovery snapshots</h3>
            <div className="section-line" />
            <button
              className="action-btn"
              onClick={async () => {
                await captureSnapshot('manual', true);
                toast('Snapshot captured');
              }}
            >
              Capture now
            </button>
          </div>
          <div className="snapshot-list">
            {visibleSnapshots.map((snapshot) => (
              <div className="snapshot-item" key={snapshot.id}>
                <div>
                  <strong>{new Date(snapshot.createdAt).toLocaleString()}</strong>
                  <span>
                    {totalSnapshotTabs(snapshot)} tabs · {snapshot.reason}
                  </span>
                </div>
                <button
                  className="action-btn"
                  onClick={async () => {
                    const count = await restoreSnapshot(snapshot.id);
                    toast(count ? `Restored ${count} missing tabs` : 'Everything is already open');
                  }}
                >
                  Restore missing
                </button>
                <button
                  className="banner-dismiss"
                  aria-label="Delete snapshot"
                  onClick={() => deleteSnapshot(snapshot.id)}
                >
                  ×
                </button>
              </div>
            ))}
            {snapshots.length > SNAPSHOT_PREVIEW && (
              <button
                className={`archive-toggle${showAllSnapshots ? ' open' : ''}`}
                aria-expanded={showAllSnapshots}
                onClick={() => setShowAllSnapshots((v) => !v)}
              >
                <ChevronIcon className="archive-chevron" />
                {showAllSnapshots ? 'Show fewer' : 'Show all'}
                <span className="archive-count">({snapshots.length})</span>
              </button>
            )}
            {!snapshots.length && (
              <div className="deferred-empty">Snapshots appear automatically every 15 minutes.</div>
            )}
          </div>
        </section>

        <section className="control-section">
          <div className="section-header">
            <h3>Tab health</h3>
            <div className="section-line" />
          </div>
          <div className="health-grid">
            <button
              onClick={async () => {
                const closed = await closeDuplicateTabs(health.duplicates.map((tab) => tab.url));
                await pushClosed('Duplicates', closed);
                await onRefresh();
              }}
            >
              <strong>{health.duplicates.length}</strong>
              <span>duplicate copies</span>
            </button>
            <button
              onClick={async () => {
                await suspendInactiveTabs();
                await onRefresh();
              }}
            >
              <strong>{health.discardable.length}</strong>
              <span>can suspend</span>
            </button>
            <button onClick={cleanTracking}>
              <strong>{health.tracking.length}</strong>
              <span>tracking URLs</span>
            </button>
            <div>
              <strong>{health.stale.length}</strong>
              <span>older than 30 days</span>
            </div>
          </div>
        </section>

        <section className="control-section">
          <div className="section-header">
            <h3>Automation rules</h3>
            <div className="section-line" />
          </div>
          <div className="rule-builder">
            <input
              value={hostname}
              onChange={(event) => setHostname(event.target.value)}
              placeholder="Domain (optional)"
              aria-label="Rule domain"
            />
            <input
              type="number"
              min={0}
              max={365}
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              aria-label="Older than days"
            />
            <select
              value={action}
              onChange={(event) => setAction(event.target.value as AutomationAction)}
              aria-label="Rule action"
            >
              <option value="stash">Stash</option>
              <option value="close-duplicates">Close duplicates</option>
              <option value="suspend">Suspend</option>
            </select>
            <button className="action-btn" onClick={createRule}>
              Add rule
            </button>
          </div>
          <div className="rule-list">
            {rules.map((rule) => (
              <div className="rule-item" key={rule.id}>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(event) =>
                    updateAutomationRule(rule.id, { enabled: event.target.checked })
                  }
                />
                <span>
                  <strong>{rule.name}</strong> · {rule.hostname || 'any domain'} ·{' '}
                  {rule.olderThanDays ? `${rule.olderThanDays}+ days` : 'any age'} → {rule.action}
                </span>
                <button
                  className="banner-dismiss"
                  aria-label={`Delete ${rule.name}`}
                  onClick={() => deleteAutomationRule(rule.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
