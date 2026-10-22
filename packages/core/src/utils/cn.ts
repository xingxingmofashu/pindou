import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge conditional Tailwind class lists, resolving conflicts with
 * `tailwind-merge`.
 *
 * Kept as a free function (not a class method) on purpose: shadcn-generated
 * components call `cn(...)` directly and those files must never be edited by
 * hand.
 *
 * @param inputs - Class values accepted by `clsx`.
 * @returns The merged class string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
