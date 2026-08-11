"use client"

import { useReportWebVitals } from "next/web-vitals"

/**
 * Reports Core Web Vitals. Wire the callback to your analytics of choice
 * (GA4/Plausible/Vercel Analytics); in dev it logs to the console only.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV === "development") {
      console.debug("[web-vitals]", metric.name, metric.value)
    }
  })
  return null
}
