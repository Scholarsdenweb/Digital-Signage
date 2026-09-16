import { prisma } from '../../lib/prisma.js';
import { NotFound, BadRequest } from '../../lib/errors.js';
import { CONTENT_STATUS, ROLES, type RoleName, type PlaylistDto, type PlaylistItemDto } from '@dsm/shared';
import { env } from '../../env.js';
import { toContentDto, contentInclude } from '../content/content.mapper.js';
import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

// Generous interactive-transaction bounds so publishes/edits survive a high-latency
// (e.g. serverless/remote) database instead of hitting the 5s default and 500-ing.
const TX_OPTS = { timeout: 20_000, maxWait: 10_000 } as const;

async function getOrCreatePlaylist(screenId: string) {
  const screen = await prisma.screen.findUnique({ where: { id: screenId } });
  if (!screen) throw NotFound('Screen not found');
  let playlist = await prisma.playlist.findUnique({ where: { screenId } });
  if (!playlist) playlist = await prisma.playlist.create({ data: { screenId } });
  return { screen, playlist };
}

/** Ensures a DRAFT working copy exists, seeded from LIVE the first time. */
async function ensureDraft(tx: Tx, playlistId: string) {
  const playlist = await tx.playlist.findUnique({ where: { id: playlistId } });
  // Once initialized, the draft is authoritative — never re-seed (even if empty).
  if (playlist?.draftInitialized) return;

  const draftCount = await tx.playlistItem.count({ where: { playlistId, stage: 'DRAFT' } });
  if (draftCount === 0) {
    const live = await tx.playlistItem.findMany({
      where: { playlistId, stage: 'LIVE' },
      orderBy: { position: 'asc' },
    });
    if (live.length > 0) {
      // skipDuplicates guards against a concurrent ensureDraft (e.g. the editor
      // page double-loading) trying to seed the same positions at once.
      await tx.playlistItem.createMany({
        data: live.map((i) => ({
          playlistId,
          stage: 'DRAFT' as const,
          position: i.position,
          durationSec: i.durationSec,
          contentId: i.contentId,
        })),
        skipDuplicates: true,
      });
    }
  }
  // Mark initialized so future edits (including emptying the draft) are respected.
  await tx.playlist.update({ where: { id: playlistId }, data: { draftInitialized: true } });
}

/** Rewrites the DRAFT items with contiguous 0-based positions (avoids unique clashes). */
async function rewriteDraft(
  tx: Tx,
  playlistId: string,
  items: { contentId: string; durationSec: number }[],
) {
  await tx.playlistItem.deleteMany({ where: { playlistId, stage: 'DRAFT' } });
  if (items.length > 0) {
    await tx.playlistItem.createMany({
      data: items.map((it, idx) => ({
        playlistId,
        stage: 'DRAFT' as const,
        position: idx,
        durationSec: it.durationSec,
        contentId: it.contentId,
      })),
    });
  }
  await tx.playlist.update({ where: { id: playlistId }, data: { draftUpdatedAt: new Date() } });
}

interface DraftEntry {
  id?: string;
  contentId: string;
  durationSec: number;
}

async function loadDraftArray(tx: Tx, playlistId: string): Promise<DraftEntry[]> {
  const items = await tx.playlistItem.findMany({
    where: { playlistId, stage: 'DRAFT' },
    orderBy: { position: 'asc' },
  });
  return items.map((i) => ({ id: i.id, contentId: i.contentId, durationSec: i.durationSec }));
}

// ── Read APIs ──

async function buildItemsDto(playlistId: string, stage: 'DRAFT' | 'LIVE'): Promise<PlaylistItemDto[]> {
  const items = await prisma.playlistItem.findMany({
    where: { playlistId, stage },
    orderBy: { position: 'asc' },
    include: { content: { include: contentInclude } },
  });
  return Promise.all(
    items.map(async (i) => ({
      id: i.id,
      position: i.position,
      durationSec: i.durationSec,
      content: await toContentDto(i.content),
    })),
  );
}

function itemsSignature(items: { content: { id: string }; durationSec: number }[]) {
  return items.map((i) => `${i.content.id}:${i.durationSec}`).join('|');
}

/** Editor view: DRAFT items + whether they differ from LIVE. */
export async function getEditorPlaylist(screenId: string): Promise<PlaylistDto> {
  const { screen, playlist } = await getOrCreatePlaylist(screenId);
  await prisma.$transaction((tx) => ensureDraft(tx, playlist.id));
  const [draft, live] = await Promise.all([
    buildItemsDto(playlist.id, 'DRAFT'),
    buildItemsDto(playlist.id, 'LIVE'),
  ]);
  return {
    screenId,
    screenKey: screen.screenKey,
    version: playlist.liveVersion,
    items: draft,
    hasDraftChanges: itemsSignature(draft) !== itemsSignature(live),
  };
}

/** Live view: what the device plays. */
export async function getLivePlaylist(screenId: string): Promise<PlaylistDto> {
  const { screen, playlist } = await getOrCreatePlaylist(screenId);
  const live = await buildItemsDto(playlist.id, 'LIVE');
  return {
    screenId,
    screenKey: screen.screenKey,
    version: playlist.liveVersion,
    items: live,
    hasDraftChanges: false,
  };
}

// ── Mutations (operate on DRAFT) ──

export async function addItem(
  screenId: string,
  input: { contentId: string; durationSec?: number; position?: number },
) {
  const { playlist } = await getOrCreatePlaylist(screenId);
  const content = await prisma.content.findUnique({ where: { id: input.contentId } });
  if (!content) throw NotFound('Content not found');

  await prisma.$transaction(async (tx) => {
    await ensureDraft(tx, playlist.id);
    const arr = await loadDraftArray(tx, playlist.id);
    const entry = { contentId: input.contentId, durationSec: input.durationSec ?? content.defaultDurationSec };
    const pos = input.position ?? arr.length;
    if (pos < 0 || pos > arr.length) throw BadRequest('Invalid insertion position');
    arr.splice(pos, 0, entry);
    await rewriteDraft(tx, playlist.id, arr);
  }, TX_OPTS);
  return getEditorPlaylist(screenId);
}

/** Replace an item's content while preserving its queue position. */
export async function replaceItem(
  screenId: string,
  itemId: string,
  input: { contentId: string; durationSec?: number },
) {
  const { playlist } = await getOrCreatePlaylist(screenId);
  const content = await prisma.content.findUnique({ where: { id: input.contentId } });
  if (!content) throw NotFound('Content not found');

  await prisma.$transaction(async (tx) => {
    await ensureDraft(tx, playlist.id);
    const arr = await loadDraftArray(tx, playlist.id);
    const idx = arr.findIndex((i) => i.id === itemId);
    if (idx === -1) throw NotFound('Playlist item not found');
    arr[idx] = {
      id: arr[idx].id,
      contentId: input.contentId,
      durationSec: input.durationSec ?? content.defaultDurationSec,
    };
    await rewriteDraft(tx, playlist.id, arr); // position preserved (same index)
  }, TX_OPTS);
  return getEditorPlaylist(screenId);
}

/** Change how long a playlist item is shown (its duration in seconds). */
export async function updateItemDuration(screenId: string, itemId: string, durationSec: number) {
  const { playlist } = await getOrCreatePlaylist(screenId);
  await prisma.$transaction(async (tx) => {
    await ensureDraft(tx, playlist.id);
    const item = await tx.playlistItem.findFirst({
      where: { id: itemId, playlistId: playlist.id, stage: 'DRAFT' },
    });
    if (!item) throw NotFound('Playlist item not found');
    await tx.playlistItem.update({ where: { id: itemId }, data: { durationSec } });
    await tx.playlist.update({ where: { id: playlist.id }, data: { draftUpdatedAt: new Date() } });
  }, TX_OPTS);
  return getEditorPlaylist(screenId);
}

export async function removeItem(screenId: string, itemId: string) {
  const { playlist } = await getOrCreatePlaylist(screenId);
  await prisma.$transaction(async (tx) => {
    await ensureDraft(tx, playlist.id);
    const arr = await loadDraftArray(tx, playlist.id);
    const next = arr.filter((i) => i.id !== itemId);
    if (next.length === arr.length) throw NotFound('Playlist item not found');
    await rewriteDraft(tx, playlist.id, next);
  }, TX_OPTS);
  return getEditorPlaylist(screenId);
}

export async function reorder(screenId: string, itemIds: string[]) {
  const { playlist } = await getOrCreatePlaylist(screenId);
  await prisma.$transaction(async (tx) => {
    await ensureDraft(tx, playlist.id);
    const arr = await loadDraftArray(tx, playlist.id);
    const byId = new Map(arr.map((i) => [i.id, i]));
    if (itemIds.length !== arr.length || itemIds.some((id) => !byId.has(id)))
      throw BadRequest('Reorder list must contain exactly the current item ids');
    const next = itemIds.map((id) => byId.get(id)!);
    await rewriteDraft(tx, playlist.id, next);
  }, TX_OPTS);
  return getEditorPlaylist(screenId);
}

/**
 * Publish: DRAFT becomes LIVE atomically. Content leaving LIVE is written to
 * history (REPLACED if that position now holds different content, else REMOVED).
 * Returns the new live version; the caller broadcasts PLAYLIST_UPDATED.
 */
export async function publish(screenId: string): Promise<{ version: number }> {
  const { playlist } = await getOrCreatePlaylist(screenId);
  const retentionMs = env.historyRetentionDays * 24 * 60 * 60 * 1000;

  // Seed the draft if needed (tiny standalone tx).
  await prisma.$transaction((tx) => ensureDraft(tx, playlist.id), TX_OPTS);

  // Do the reads and diff OUTSIDE the write transaction so the transaction stays
  // short (a few batched writes) and never times out on a high-latency DB.
  const [draft, live] = await Promise.all([
    prisma.playlistItem.findMany({
      where: { playlistId: playlist.id, stage: 'DRAFT' },
      orderBy: { position: 'asc' },
    }),
    prisma.playlistItem.findMany({
      where: { playlistId: playlist.id, stage: 'LIVE' },
      include: { content: true },
      orderBy: { position: 'asc' },
    }),
  ]);

  const newContentIds = [...new Set(draft.map((d) => d.contentId))];
  const newContentIdSet = new Set(newContentIds);
  const draftPositions = new Map(draft.map((d) => [d.position, d.contentId]));
  const leaving = live.filter((l) => !newContentIdSet.has(l.contentId));

  // One query to find which leaving items are still LIVE on other screens.
  const leavingIds = leaving.map((l) => l.contentId);
  const stillElsewhere = leavingIds.length
    ? await prisma.playlistItem.findMany({
        where: { contentId: { in: leavingIds }, stage: 'LIVE', NOT: { playlistId: playlist.id } },
        select: { contentId: true },
        distinct: ['contentId'],
      })
    : [];
  const stillElsewhereSet = new Set(stillElsewhere.map((x) => x.contentId));

  const expiresAt = new Date(Date.now() + retentionMs);
  const historyRows = leaving.map((old) => ({
    originalContentId: old.contentId,
    title: old.content.title,
    type: old.content.type,
    ownerId: old.content.ownerId,
    mediaObjectId: old.content.mediaObjectId,
    screenId,
    durationSec: old.durationSec,
    reason:
      draftPositions.has(old.position) && draftPositions.get(old.position) !== old.contentId
        ? ('REPLACED' as const)
        : ('REMOVED' as const),
    publishedAt: playlist.livePublishedAt,
    expiresAt,
  }));
  const toArchive = leaving.filter((l) => !stillElsewhereSet.has(l.contentId)).map((l) => l.contentId);

  // Short write transaction: only batched writes, bounded round-trips.
  const version = await prisma.$transaction(async (tx) => {
    if (historyRows.length) await tx.contentHistory.createMany({ data: historyRows });
    if (toArchive.length)
      await tx.content.updateMany({ where: { id: { in: toArchive } }, data: { status: CONTENT_STATUS.ARCHIVED } });

    await tx.playlistItem.deleteMany({ where: { playlistId: playlist.id, stage: 'LIVE' } });
    if (draft.length > 0) {
      await tx.playlistItem.createMany({
        data: draft.map((d) => ({
          playlistId: playlist.id,
          stage: 'LIVE' as const,
          position: d.position,
          durationSec: d.durationSec,
          contentId: d.contentId,
        })),
      });
      await tx.content.updateMany({
        where: { id: { in: newContentIds } },
        data: { status: CONTENT_STATUS.LIVE },
      });
    }

    const updated = await tx.playlist.update({
      where: { id: playlist.id },
      data: { liveVersion: { increment: 1 }, livePublishedAt: new Date() },
    });
    return updated.liveVersion;
  }, TX_OPTS);

  return { version };
}

// ── Publish to multiple screens / groups ──

interface Actor {
  userId: string;
  role: RoleName;
}

/** Of the given screens, which may the actor act on (admin: all; handler: assigned). */
async function accessibleScreens(actor: Actor, screenIds: string[]): Promise<Set<string>> {
  if (actor.role === ROLES.ADMIN) return new Set(screenIds);
  const assigned = await prisma.screenHandler.findMany({
    where: { userId: actor.userId, screenId: { in: screenIds } },
    select: { screenId: true },
  });
  return new Set(assigned.map((a) => a.screenId));
}

/** Ordered content of the source screen's DRAFT (what Publish would make live). */
async function getSourceDraftItems(sourceScreenId: string) {
  const { playlist } = await getOrCreatePlaylist(sourceScreenId);
  await prisma.$transaction((tx) => ensureDraft(tx, playlist.id), TX_OPTS);
  const items = await prisma.playlistItem.findMany({
    where: { playlistId: playlist.id, stage: 'DRAFT' },
    orderBy: { position: 'asc' },
    select: { contentId: true, durationSec: true },
  });
  return items.map((i) => ({ contentId: i.contentId, durationSec: i.durationSec }));
}

/** Overwrite a screen's DRAFT with the given items (used to mirror a source playlist). */
async function setDraftFromItems(screenId: string, items: { contentId: string; durationSec: number }[]) {
  const { playlist } = await getOrCreatePlaylist(screenId);
  await prisma.$transaction(async (tx) => {
    await tx.playlistItem.deleteMany({ where: { playlistId: playlist.id, stage: 'DRAFT' } });
    if (items.length > 0) {
      await tx.playlistItem.createMany({
        data: items.map((it, idx) => ({
          playlistId: playlist.id,
          stage: 'DRAFT' as const,
          position: idx,
          durationSec: it.durationSec,
          contentId: it.contentId,
        })),
      });
    }
    await tx.playlist.update({ where: { id: playlist.id }, data: { draftUpdatedAt: new Date() } });
  }, TX_OPTS);
}

/**
 * Copy the source screen's current draft to every target screen (resolved from
 * explicit ids + groups) and publish each. Targets the actor may not access are
 * skipped (permissions enforced server-side). Returns per-screen versions.
 */
export async function publishToScreens(
  actor: Actor,
  sourceScreenId: string,
  opts: { screenIds: string[]; screenGroupIds: string[]; includeSource: boolean },
): Promise<{ results: { screenId: string; screenKey: string; version: number }[]; skipped: number }> {
  const groupScreens = opts.screenGroupIds.length
    ? await prisma.screen.findMany({ where: { screenGroupId: { in: opts.screenGroupIds } }, select: { id: true } })
    : [];

  const targetSet = new Set<string>([...opts.screenIds, ...groupScreens.map((s) => s.id)]);
  if (opts.includeSource) targetSet.add(sourceScreenId);
  else targetSet.delete(sourceScreenId);

  const allTargets = [...targetSet];
  const allowed = await accessibleScreens(actor, allTargets);
  const targets = allTargets.filter((id) => allowed.has(id));
  const skipped = allTargets.length - targets.length;

  const sourceItems = await getSourceDraftItems(sourceScreenId);

  const results: { screenId: string; screenKey: string; version: number }[] = [];
  for (const targetId of targets) {
    if (targetId !== sourceScreenId) await setDraftFromItems(targetId, sourceItems);
    const { version } = await publish(targetId);
    const screen = await prisma.screen.findUnique({ where: { id: targetId }, select: { screenKey: true } });
    results.push({ screenId: targetId, screenKey: screen?.screenKey ?? targetId, version });
  }
  return { results, skipped };
}

/**
 * Publish a fixed set of content as the LIVE playlist for the given screens,
 * REPLACING whatever they were showing. Durations default to each content's own.
 * Returns per-screen new versions; the caller broadcasts.
 */
export async function publishItemsToScreens(
  screenIds: string[],
  rawItems: { contentId: string; durationSec?: number }[],
): Promise<{ screenId: string; version: number }[]> {
  const contents = await prisma.content.findMany({
    where: { id: { in: rawItems.map((i) => i.contentId) } },
    select: { id: true, defaultDurationSec: true },
  });
  const durMap = new Map(contents.map((c) => [c.id, c.defaultDurationSec]));
  const items = rawItems
    .filter((i) => durMap.has(i.contentId)) // ignore unknown content ids
    .map((i) => ({ contentId: i.contentId, durationSec: i.durationSec ?? durMap.get(i.contentId) ?? 15 }));

  const results: { screenId: string; version: number }[] = [];
  for (const screenId of screenIds) {
    await setDraftFromItems(screenId, items);
    const { version } = await publish(screenId);
    results.push({ screenId, version });
  }
  return results;
}
