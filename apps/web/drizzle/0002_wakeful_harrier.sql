ALTER TABLE "patterns" RENAME COLUMN "brand_id" TO "fk_brand_id";--> statement-breakpoint
UPDATE "patterns" SET "fk_brand_id" = (SELECT "id" FROM "brands" WHERE "brands"."code" = "patterns"."fk_brand_id");--> statement-breakpoint
ALTER TABLE "patterns" ALTER COLUMN "fk_brand_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "patterns" ALTER COLUMN "fk_brand_id" SET DATA TYPE uuid USING "fk_brand_id"::uuid;--> statement-breakpoint
ALTER TABLE "patterns" ADD CONSTRAINT "patterns_fk_brand_id_brands_id_fk" FOREIGN KEY ("fk_brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;
