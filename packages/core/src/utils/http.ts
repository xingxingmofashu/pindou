/** JSON-over-HTTP client shared by the SWR hooks and publish/edit flows. */
export class Http {
  /**
   * JSON GET that throws on non-OK responses, so SWR records the failure in
   * its `error` state instead of returning the error body.
   *
   * @param url - The endpoint to call.
   * @returns The parsed JSON body.
   */
  static async get<T = unknown>(url: string): Promise<T> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Request failed (${res.status})`)
    return (await res.json()) as T
  }

  /**
   * POST (or PATCH) a JSON string or `FormData` body and parse the JSON
   * response.
   *
   * Non-OK responses are unwrapped via the shared `{ error }` envelope and
   * thrown as `Error`s, so callers catch a single exception type. FormData
   * bodies are sent as-is (the browser sets `multipart/form-data`); string
   * bodies are sent as `application/json`.
   *
   * @param url          - The endpoint to call.
   * @param body         - A JSON string, or a FormData payload.
   * @param fallbackText - Error message used when the response body isn't a
   *                       valid `{ error }` envelope.
   * @param method       - HTTP method to use (defaults to `POST`).
   * @returns The parsed JSON body.
   */
  static async send<T>(
    url: string,
    body: string | FormData,
    fallbackText = `Request failed`,
    method: "POST" | "PATCH" = "POST",
  ): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: typeof body === "string" ? { "Content-Type": "application/json" } : undefined,
      body,
    })
    const data: unknown = await res.json()
    if (!res.ok) {
      const parsed = (data as { error?: unknown } | null)?.error
      throw new Error(typeof parsed === "string" ? parsed : fallbackText)
    }
    return data as T
  }
}
