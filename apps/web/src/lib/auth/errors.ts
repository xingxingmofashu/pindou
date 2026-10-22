/** Shape of the errors returned by the Better Auth client. */
interface AuthErrorLike {
  code?: string
  status?: number
}

const ERROR_KEYS: Record<string, string> = {
  INVALID_EMAIL: "auth.errors.invalidEmail",
  INVALID_EMAIL_OR_PASSWORD: "auth.errors.invalidCredentials",
  INVALID_PASSWORD: "auth.errors.invalidCredentials",
  USER_ALREADY_EXISTS: "auth.errors.emailExists",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "auth.errors.emailExists",
  PASSWORD_TOO_SHORT: "auth.errors.passwordTooShort",
  PASSWORD_TOO_LONG: "auth.errors.passwordTooLong",
  INVALID_TOKEN: "auth.errors.invalidToken",
  TOO_MANY_REQUESTS: "auth.errors.tooManyRequests",
  EMAIL_NOT_VERIFIED: "auth.errors.emailNotVerified",
  ACCOUNT_NOT_LINKED: "auth.errors.accountNotLinked",
  account_not_linked: "auth.errors.accountNotLinked",
}

/**
 * Map a Better Auth error, or an OAuth `?error=` code, to an i18n key.
 *
 * Unknown errors intentionally collapse to a generic message so raw provider
 * text is never shown to the user.
 *
 * @param error - A thrown error, a Better Auth error object, or a code string.
 * @returns A dotted dictionary key under `auth.errors`.
 */
export function authErrorKey(error: unknown): string {
  if (typeof error === "string") {
    return ERROR_KEYS[error] ?? "auth.errors.generic"
  }

  if (!error || typeof error !== "object") return "auth.errors.generic"

  const { code, status } = error as AuthErrorLike
  if (status === 429) return "auth.errors.tooManyRequests"
  if (code && ERROR_KEYS[code]) return ERROR_KEYS[code]
  return "auth.errors.generic"
}
