import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFakeBrowser } from '../fakeBrowser';
import { addAutomationRule } from '../../utils/automation';
import { decryptBackup, encryptBackup, exportAll, importAll } from '../../utils/backup';
import { saveRoutine, setRoutineSchedule } from '../../utils/routines';
import { saveSession, updateSessionMeta } from '../../utils/sessions';
import {
  checkOffSavedTab,
  getSavedTabs,
  saveTabForLater,
  updateSavedTabMeta,
} from '../../utils/storage';
import { createWorkspace } from '../../utils/workspaces';

vi.mock('wxt/browser', async () => ({ browser: (await import('../fakeBrowser')).fakeBrowser }));

beforeEach(() => resetFakeBrowser());

/** Fill every store with data that uses all the metadata the types allow. */
async function seed() {
  const tabs = [
    { url: 'https://a.test/', title: 'A', pinned: true, group: 'Work', tags: ['x'], note: 'n' },
    { url: 'https://b.test/', title: 'B' },
  ];
  const session = await saveSession('Stash', tabs);
  await updateSessionMeta(session!.id, { tags: ['reading'], note: 'later' });
  const routine = await saveRoutine('Morning', tabs);
  await setRoutineSchedule(routine!.id, '08:30');
  await createWorkspace('Deep work', tabs);
  await saveTabForLater({ url: 'https://saved.test/', title: 'Saved' });
  await saveTabForLater({ url: 'https://done.test/', title: 'Done' });
  const { active } = await getSavedTabs();
  await updateSavedTabMeta(active[0].id, { tags: ['tagged'], note: 'a note' });
  await checkOffSavedTab(active[1].id);
  await addAutomationRule({
    name: 'Old docs',
    enabled: true,
    hostname: 'docs.test',
    olderThanDays: 7,
    action: 'suspend',
    excludePinned: false,
  });
}

/** A backup as it comes back from a .json file. */
const asFile = <T>(value: T): unknown => JSON.parse(JSON.stringify(value));
const withoutStamp = ({ exportedAt: _, ...rest }: Awaited<ReturnType<typeof exportAll>>) => rest;

describe('backup round trip', () => {
  it('keeps every metadata field through export and import', async () => {
    await seed();
    const before = await exportAll();
    resetFakeBrowser();

    await importAll(asFile(before));
    const after = await exportAll();
    expect(withoutStamp(after)).toEqual(withoutStamp(before));
    expect(after.sessions[0].tabs[0]).toMatchObject({ pinned: true, group: 'Work', note: 'n' });
    expect(after.deferred[0]).toMatchObject({ tags: ['tagged'], note: 'a note' });
    expect(after.routines[0].schedule).toBe('08:30');
  });

  it('keeps the same metadata through an encrypted backup', async () => {
    await seed();
    const before = await exportAll();
    const envelope = asFile(await encryptBackup('correct horse'));
    resetFakeBrowser();

    await importAll(await decryptBackup(envelope, 'correct horse'));
    expect(withoutStamp(await exportAll())).toEqual(withoutStamp(before));
  });

  it('drops malformed metadata and defaults unsafe rule fields', async () => {
    await importAll({
      app: 'perch',
      sessions: [
        {
          id: 's1',
          name: 'S',
          createdAt: '2026-01-01T00:00:00.000Z',
          tags: ['ok', 3],
          note: 42,
          extra: 'not ours',
          tabs: [{ url: 'https://a.test/', title: 'A', pinned: 'yes', tags: 'oops' }],
        },
      ],
      routines: [{ id: 'r1', name: 'R', tabs: [], schedule: 'soon' }],
      automationRules: [
        { id: 'a', name: 'A', hostname: '', action: 'stash', olderThanDays: 'x' },
        { id: 'b', name: 'B', hostname: '', action: 'stash', olderThanDays: 3, enabled: true },
      ],
    });
    const { sessions, routines, automationRules } = await exportAll();
    expect(sessions[0]).toEqual({
      id: 's1',
      name: 'S',
      createdAt: '2026-01-01T00:00:00.000Z',
      tags: ['ok'],
      tabs: [{ url: 'https://a.test/', title: 'A' }],
    });
    expect(routines[0].schedule).toBeUndefined();
    expect(automationRules).toEqual([
      {
        id: 'b',
        name: 'B',
        enabled: true,
        hostname: '',
        olderThanDays: 3,
        action: 'stash',
        excludePinned: true,
      },
    ]);
  });
});
