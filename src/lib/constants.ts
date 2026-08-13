/** Grid dimensions are limited only to prevent memory abuse. */
export const MAX_GRID_DIMENSION = 4096

/**
 * Hard cap on the number of grid cells a published pattern may hold (≈1000×1000).
 * Bounds the wire JSON (~5–7 MB dense), R2 object size, and the server-side
 * thumbnail render. `MAX_GRID_DIMENSION` stays as the per-side drawing window;
 * this is the total-cell budget enforced on publish/edit and by the importer.
 */
export const MAX_GRID_CELLS = 1_000_000

/** Hard cap on a single image upload (the import dialog mirrors it). */
export const MAX_FILE_BYTES = 40 * 1024 * 1024
/** Hard cap on a publish/edit JSON body — stays within the grid budget above. */
export const MAX_BODY_BYTES = 20 * 1024 * 1024

/** Per-user budget for publish/edit — both render a thumbnail and upload to R2. */
export const PATTERN_WRITE_LIMIT = 20
export const PATTERN_WRITE_WINDOW_MS = 60_000

/**
 * Sources above this many pixels are rejected by the import worker. The browser
 * has no header-only metadata API, so the image is decoded first and this check
 * bounds the downstream quantization work (~160 MB RGBA worst case), not the
 * decode itself — the browser's own decoder limits guard against decompression
 * bombs.
 */
export const MAX_INPUT_PIXELS = 40_000_000

/** World units per data cell. */
export const CELL = 10

/** Minimum screen pixels per visual cell — drives the LOD threshold. */
export const MIN_PX = 10

/** Default zoom for a fresh canvas (also the pattern-viewer default). */
export const DEFAULT_ZOOM = 3

/** Clamp range for the editor zoom (screen pixels per world unit). */
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 20

/** Multiplicative zoom step for the mouse wheel. */
export const ZOOM_FACTOR = 1.15

/** Multiplicative zoom step for the zoom-in / zoom-out buttons. */
export const ZOOM_STEP = 1.3

/** Number of patterns per page in the catalog. */
export const PATTERNS_PAGE_SIZE = 20

/** Default step (in data cells) of the export major grid that groups beads in blocks. */
export const MAJOR_GRID_STEP = 8

/** Repository URL used in the layout footer/header links. */
export const GITHUB_URL = "https://github.com/xingxingmofashu/pindou"

/** Background colour of the editor canvas (also the thumbnail background). */
export const EDITOR_BG = "#fafafa"
