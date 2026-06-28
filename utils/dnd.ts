/** Drag-and-drop payload helpers for dragging a tab into a stash or saved list. */

export const PERCH_TAB_MIME = 'application/x-perch-tab';

export interface DragTab {
  url: string;
  title: string;
}

export function setDragTab(dt: DataTransfer, tab: DragTab): void {
  dt.setData(PERCH_TAB_MIME, JSON.stringify(tab));
  dt.effectAllowed = 'move';
}

export function getDragTab(dt: DataTransfer): DragTab | null {
  try {
    const raw = dt.getData(PERCH_TAB_MIME);
    if (!raw) return null;
    const obj = JSON.parse(raw) as DragTab;
    return obj && obj.url ? obj : null;
  } catch {
    return null;
  }
}

/* ---- Dragging a stash row to reorder ---- */

export const PERCH_SESSION_MIME = 'application/x-perch-session';

export function setDragSession(dt: DataTransfer, id: string): void {
  dt.setData(PERCH_SESSION_MIME, id);
  dt.effectAllowed = 'move';
}

export function getDragSession(dt: DataTransfer): string | null {
  try {
    return dt.getData(PERCH_SESSION_MIME) || null;
  } catch {
    return null;
  }
}

/** Move the item identified by draggedId to the position of targetId. Pure. */
export function reorderById<T>(
  items: T[],
  draggedId: string,
  targetId: string,
  getId: (t: T) => string,
): T[] {
  const from = items.findIndex((i) => getId(i) === draggedId);
  const to = items.findIndex((i) => getId(i) === targetId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
