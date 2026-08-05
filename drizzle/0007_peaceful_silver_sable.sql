ALTER TABLE "brands" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "brands" SET "sort_order" = CASE "code"
  WHEN 'mard' THEN 0
  WHEN 'perler' THEN 1
  WHEN 'artkal' THEN 2
  WHEN 'hama' THEN 3
END;