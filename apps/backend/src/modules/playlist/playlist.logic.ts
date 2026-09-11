/**
 * Pure, DB-free playlist algorithms. These encode the core queue rules
 * (insert-at-position, replace-preserving-position, reorder, history diff)
 * so they can be unit-tested in isolation.
 */

export interface QueueEntry {
  id?: string;
  contentId: string;
  durationSec: number;
}

export function insertAt(items: QueueEntry[], entry: QueueEntry, position?: number): QueueEntry[] {
  const arr = [...items];
  const pos = position ?? arr.length;
  if (pos < 0 || pos > arr.length) throw new Error('Invalid insertion position');
  arr.splice(pos, 0, entry);
  return arr;
}

/** Swaps the content at the item's slot but keeps its index (queue position). */
export function replacePreservingPosition(
  items: QueueEntry[],
  itemId: string,
  entry: Omit<QueueEntry, 'id'>,
): QueueEntry[] {
  const idx = items.findIndex((i) => i.id === itemId);
  if (idx === -1) throw new Error('Playlist item not found');
  const arr = [...items];
  arr[idx] = { id: arr[idx].id, contentId: entry.contentId, durationSec: entry.durationSec };
  return arr;
}

export function removeById(items: QueueEntry[], itemId: string): QueueEntry[] {
  const next = items.filter((i) => i.id !== itemId);
  if (next.length === items.length) throw new Error('Playlist item not found');
  return next;
}

export function reorderByIds(items: QueueEntry[], itemIds: string[]): QueueEntry[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  if (itemIds.length !== items.length || itemIds.some((id) => !byId.has(id)))
    throw new Error('Reorder list must contain exactly the current item ids');
  return itemIds.map((id) => byId.get(id)!);
}

export interface LivePosition {
  position: number;
  contentId: string;
}
export interface HistoryDiffEntry {
  contentId: string;
  reason: 'REPLACED' | 'REMOVED';
}

/**
 * Content present in the old LIVE list but absent from the new list has left the
 * playlist. It is REPLACED if that position now holds different content, else REMOVED.
 */
export function computeHistoryDiff(
  oldLive: LivePosition[],
  newLive: LivePosition[],
): HistoryDiffEntry[] {
  const newContentIds = new Set(newLive.map((n) => n.contentId));
  const newByPos = new Map(newLive.map((n) => [n.position, n.contentId]));
  const out: HistoryDiffEntry[] = [];
  for (const old of oldLive) {
    if (newContentIds.has(old.contentId)) continue;
    const replaced = newByPos.has(old.position) && newByPos.get(old.position) !== old.contentId;
    out.push({ contentId: old.contentId, reason: replaced ? 'REPLACED' : 'REMOVED' });
  }
  return out;
}
