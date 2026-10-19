/** Settings modal — theme, stale threshold, and data export/import. */

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { decryptBackup, downloadBackup, downloadEncryptedBackup, importAll } from '../utils/backup';
import type { Settings, Theme } from '../utils/settings';
import { useToast } from './Toast';

interface SettingsModalProps {
  open: boolean;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

function StaleDaysControl({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <div className="setting-stepper">
      <input
        type="range"
        min={1}
        max={30}
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        aria-label="Stale threshold in days"
      />
      <span className="setting-value">{draft}d</span>
    </div>
  );
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const overlayMouseDownRef = useRef(false);
  const showToast = useToast();
  useFocusTrap(open, dialogRef);

  const handleExport = async () => {
    try {
      await downloadBackup();
      showToast('Backup downloaded');
    } catch {
      showToast('Export failed');
    }
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      let data = JSON.parse(text) as unknown;
      if ((data as { app?: string })?.app === 'perch-encrypted') {
        const passphrase = window.prompt('Passphrase for this encrypted Perch backup:');
        if (!passphrase) return;
        data = await decryptBackup(data, passphrase);
      }
      const summary = await importAll(data);
      showToast(summary);
    } catch {
      showToast('Import failed: not a valid Perch backup');
    }
  };

  const handleEncryptedExport = async () => {
    const passphrase = window.prompt(
      'Choose a passphrase (8+ characters). It cannot be recovered if forgotten:',
    );
    if (!passphrase) return;
    try {
      await downloadEncryptedBackup(passphrase);
      showToast('Encrypted backup downloaded');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Encrypted export failed');
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleOverlayMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    overlayMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleOverlayMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    if (overlayMouseDownRef.current && e.target === e.currentTarget) onClose();
    overlayMouseDownRef.current = false;
  };

  if (!open) return null;

  return (
    <div
      className="palette-overlay"
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
    >
      <div
        ref={dialogRef}
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
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
            <StaleDaysControl
              key={settings.staleDays}
              value={settings.staleDays}
              onCommit={(staleDays) => onChange({ staleDays })}
            />
          </div>

          <div className="setting-row">
            <div className="setting-label">
              Backup
              <span className="setting-hint">Export or import all your data as a file</span>
            </div>
            <div className="bulk-actions">
              <button className="action-btn" onClick={handleExport}>
                Export
              </button>
              <button className="action-btn" onClick={handleEncryptedExport}>
                Export encrypted
              </button>
              <button className="action-btn" onClick={() => fileRef.current?.click()}>
                Import
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportFile(file);
                  e.target.value = '';
                }}
              />
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
