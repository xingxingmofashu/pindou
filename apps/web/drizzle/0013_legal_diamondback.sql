-- Patterns were rebuilt around R2-backed grids; old rows carry the grid JSON
-- in the renamed column, which is no longer readable — clear them.
DELETE FROM "patterns";

ALTER TABLE "patterns" RENAME COLUMN "grid_data" TO "grid_key";
ALTER TABLE "patterns" ALTER COLUMN "grid_key" SET DEFAULT '';