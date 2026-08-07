-- Sort brand colours by natural colour-code order (letter prefix, then the
-- numeric part: A1, A2, ..., A9, A10, A11, ...), renumbering sort_order. The
-- array index grid cells store is the 1-based position in this ordering, so
-- the single published pattern's grid_data is remapped through the old →
-- new index mapping to keep every bead the same colour.
BEGIN;

--> statement-breakpoint
UPDATE colors SET sort_order = sub.new_order
FROM (
  SELECT id,
         row_number() OVER (
           PARTITION BY fk_brand_id
           ORDER BY regexp_replace(code, '\d+$', ''),
                    COALESCE((regexp_match(code, '\d+$'))[1]::int, 0),
                    code
         ) - 1 AS new_order
  FROM colors
) sub
WHERE colors.id = sub.id;

--> statement-breakpoint
UPDATE patterns p
SET grid_data = (
  SELECT jsonb_agg(remapped_row ORDER BY rn)::text
  FROM (
    SELECT rn, jsonb_agg(
      CASE
        WHEN v::int = 0 THEN 0
        ELSE (
          SELECT new_idx
          FROM (
            SELECT fk_brand_id,
                   row_number() OVER (PARTITION BY fk_brand_id ORDER BY sort_order) AS old_idx,
                   row_number() OVER (PARTITION BY fk_brand_id
                     ORDER BY regexp_replace(code, '\d+$', ''),
                              COALESCE((regexp_match(code, '\d+$'))[1]::int, 0),
                              code) AS new_idx
            FROM colors
          ) ord
          WHERE ord.fk_brand_id = p.fk_brand_id AND ord.old_idx = v::int
        )
      END
    ) AS remapped_row
    FROM (
      SELECT rn, v
      FROM jsonb_array_elements(p.grid_data::jsonb) WITH ORDINALITY AS rows(row, rn)
      CROSS JOIN LATERAL jsonb_array_elements(rows.row) WITH ORDINALITY AS cells(v, cn)
    ) flat
    GROUP BY rn
  ) remapped_rows
);

--> statement-breakpoint
COMMIT;
