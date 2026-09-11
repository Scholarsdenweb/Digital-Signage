import { describe, it, expect } from 'vitest';
import {
  insertAt,
  replacePreservingPosition,
  removeById,
  reorderByIds,
  computeHistoryDiff,
  type QueueEntry,
} from '../modules/playlist/playlist.logic.js';

const mk = (id: string, contentId: string): QueueEntry => ({ id, contentId, durationSec: 10 });

describe('playlist queue rules', () => {
  // Scenario 7: content insertion at chosen position
  it('inserts a new item at the chosen position (not appended)', () => {
    const items = [mk('1', 'A'), mk('2', 'B'), mk('3', 'C')];
    const out = insertAt(items, { contentId: 'X', durationSec: 5 }, 1);
    expect(out.map((i) => i.contentId)).toEqual(['A', 'X', 'B', 'C']);
  });

  it('appends when no position is given', () => {
    const items = [mk('1', 'A')];
    const out = insertAt(items, { contentId: 'X', durationSec: 5 });
    expect(out.map((i) => i.contentId)).toEqual(['A', 'X']);
  });

  it('rejects out-of-range positions', () => {
    expect(() => insertAt([mk('1', 'A')], { contentId: 'X', durationSec: 5 }, 9)).toThrow();
  });

  // Scenario 6: replacement preserves the original queue position
  it('replaces B with X while preserving position', () => {
    const items = [mk('1', 'A'), mk('2', 'B'), mk('3', 'C'), mk('4', 'D')];
    const out = replacePreservingPosition(items, '2', { contentId: 'X', durationSec: 20 });
    expect(out.map((i) => i.contentId)).toEqual(['A', 'X', 'C', 'D']);
    expect(out[1].id).toBe('2'); // same slot
  });

  // Scenario 8: reorder
  it('reorders by the provided id ordering', () => {
    const items = [mk('1', 'A'), mk('2', 'B'), mk('3', 'C')];
    const out = reorderByIds(items, ['3', '1', '2']);
    expect(out.map((i) => i.contentId)).toEqual(['C', 'A', 'B']);
  });

  it('rejects a reorder list that does not match current items', () => {
    const items = [mk('1', 'A'), mk('2', 'B')];
    expect(() => reorderByIds(items, ['1'])).toThrow();
  });

  it('removes an item', () => {
    const items = [mk('1', 'A'), mk('2', 'B')];
    expect(removeById(items, '1').map((i) => i.contentId)).toEqual(['B']);
  });
});

describe('history diff on publish', () => {
  // Scenario 14: history creation — replaced vs removed
  it('marks REPLACED when the position now holds different content', () => {
    const oldLive = [
      { position: 0, contentId: 'A' },
      { position: 1, contentId: 'B' },
    ];
    const newLive = [
      { position: 0, contentId: 'A' },
      { position: 1, contentId: 'X' },
    ];
    expect(computeHistoryDiff(oldLive, newLive)).toEqual([{ contentId: 'B', reason: 'REPLACED' }]);
  });

  it('marks REMOVED when the item is gone and the slot no longer exists', () => {
    const oldLive = [
      { position: 0, contentId: 'A' },
      { position: 1, contentId: 'B' },
    ];
    const newLive = [{ position: 0, contentId: 'A' }];
    expect(computeHistoryDiff(oldLive, newLive)).toEqual([{ contentId: 'B', reason: 'REMOVED' }]);
  });

  it('creates no history when nothing left the live playlist', () => {
    const live = [{ position: 0, contentId: 'A' }];
    expect(computeHistoryDiff(live, live)).toEqual([]);
  });
});
