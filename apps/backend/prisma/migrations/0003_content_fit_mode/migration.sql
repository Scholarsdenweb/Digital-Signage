-- Per-content display fit mode (how media fills the screen)
CREATE TYPE "FitMode" AS ENUM ('COVER', 'CONTAIN');
ALTER TABLE "Content" ADD COLUMN "fitMode" "FitMode" NOT NULL DEFAULT 'COVER';
