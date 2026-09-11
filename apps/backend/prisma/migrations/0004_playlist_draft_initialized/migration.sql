-- Track whether a playlist's DRAFT has been initialized, so an intentionally
-- emptied draft is not re-seeded from LIVE.
ALTER TABLE "Playlist" ADD COLUMN "draftInitialized" BOOLEAN NOT NULL DEFAULT false;
