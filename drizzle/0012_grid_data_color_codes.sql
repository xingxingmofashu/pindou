-- Migrate published grid_data from 1-based palette index positions to stable
-- colour codes ("A1", "B3", …). Each cell value v (1-based, 0 = empty) is
-- resolved through the pattern's brand colours ordered by sort_order, and the
-- empty sentinel becomes "" — colour codes never shift when a palette is
-- reordered, so future reorders can't corrupt stored grids.
BEGIN;

--> statement-breakpoint
UPDATE patterns p
SET grid_data = (
  SELECT jsonb_agg(row_json ORDER BY rn)::text
  FROM (
    SELECT rn, jsonb_agg(
      CASE
        WHEN v::int = 0 THEN ''
        ELSE (
          SELECT c.code
          FROM colors c
          WHERE c.fk_brand_id = p.fk_brand_id
          ORDER BY c.sort_order
          OFFSET v::int - 1
          LIMIT 1
        )
      END
    ) AS row_json
    FROM (
      SELECT rn, v
      FROM jsonb_array_elements(p.grid_data::jsonb) WITH ORDINALITY AS rows(row, rn)
      CROSS JOIN LATERAL jsonb_array_elements(rows.row) WITH ORDINALITY AS cells(v, cn)
    ) flat
    GROUP BY rn
  ) rows_agg
);

--> statement-breakpoint
COMMIT;
