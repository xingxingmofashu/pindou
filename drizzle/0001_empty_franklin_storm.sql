CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "brands_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "colors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fk_brand_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"hex" text NOT NULL,
	"series" text,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "colors" ADD CONSTRAINT "colors_fk_brand_id_brands_id_fk" FOREIGN KEY ("fk_brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;