/**
 * Top-of-viewport loading bar shown while a route segment's loading.tsx is
 * mounted (i.e. from the moment a client navigation starts until the new
 * page's data is ready). Rendered by each loading boundary; `fixed` keeps it
 * pinned to the window top regardless of the segment it lives in. Decorative —
 * the loading boundaries themselves carry the accessible loading state.
 */
export function RouteProgress() {
  return <div aria-hidden="true" className="route-progress" />
}
