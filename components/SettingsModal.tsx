/** Settings modal — theme and stale threshold. */

import { useEffect } from 'react';
import type { Settings, Theme } from '../utils/settings';

interface SettingsModalProps {
  open: boolean;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

function Segmented<T extends string>({
  value,
  options,
  onPick,
}: {
  value: T;
  options: { value: T; label: string }[];
  onPick: (v: T) => void;
}) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          className={`segmented-btn${value === o.value ? ' active' : ''}`}
          aria-pressed={value === o.value}
          onClick={() => onPick(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      className={`toggle${checked ? ' on' : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
    >
      <span className="toggle-knob" />
    </button>
  );
}

export function SettingsModal({ open, settings, onChange, onClose }: SettingsModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="palette-overlay" onMouseDown={onClose}>
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="settings-head">
          <h2>Settings</h2>
          <button className="banner-dismiss" aria-label="Close settings" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="settings-body">
          <div className="setting-row">
            <div className="setting-label">Appearance</div>
            <Segmented<Theme>
              value={settings.theme}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              onPick={(v) => onChange({ theme: v })}
            />
          </div>

          <div className="setting-row">
            <div className="setting-label">
              Auto-stash stale tabs
              <span className="setting-hint">Hourly, stashes tabs past the threshold</span>
            </div>
            <Toggle
              checked={settings.autoStash}
              onToggle={() => onChange({ autoStash: !settings.autoStash })}
              label="Auto-stash stale tabs"
            />
          </div>

          <div className="setting-row">
            <div className="setting-label">
              Stale after
              <span className="setting-hint">Flag tabs untouched this long</span>
            </div>
            <div className="setting-stepper">
              <input
                type="range"
                min={1}
                max={30}
                value={settings.staleDays}
                onChange={(e) => onChange({ staleDays: Number(e.target.value) })}
                aria-label="Stale threshold in days"
              />
              <span className="setting-value">{settings.staleDays}d</span>
            </div>
          </div>
        </div>

        <div className="settings-foot">
          Settings sync across your devices via your browser profile.
        </div>
      </div>
    </div>
  );
}
