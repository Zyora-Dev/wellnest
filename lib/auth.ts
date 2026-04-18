import { SignJWT, jwtVerify } from "jose"
import bcrypt from "bcryptjs"
import getDb from "@/lib/db"

const COOKIE_NAME = "wellnest_session"
const SESSION_DURATION_SECONDS = 24 * 60 * 60 // 24 hours
/** Max login attempts within the window before lockout */
const RATE_LIMIT_MAX = 5
/** Window size in milliseconds */
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

function getSecret(): Uint8Array {
  const secret =
    process.env.JWT_SECRET ||
    "wellnest-fallback-secret-change-in-production-abc123"
  return new TextEncoder().encode(secret)
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────

export async function createSessionToken(email: string): Promise<string> {
  return new SignJWT({ email, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret())
}

export async function verifySessionToken(
  token: string
): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return { email: payload.email as string }
  } catch {
    return null
  }
}

// ─── Bcrypt helpers ───────────────────────────────────────────────────────────

/** Hash a plaintext password (cost factor 12). */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, 12)
}

/** Compare plaintext against a stored bcrypt hash. */
export async function verifyPassword(
  plaintext: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plaintext, hash)
}

// ─── Admin account bootstrap ─────────────────────────────────────────────────

/**
 * Ensures at least one admin account exists in the database.
 * On first run it seeds the account from environment variables.
 * Call this once at server start (e.g. from the login API route).
 */
export async function ensureAdminAccount(): Promise<void> {
  const db = getDb()
  const count = (
    db.prepare("SELECT COUNT(*) as c FROM admin_accounts").get() as {
      c: number
    }
  ).c

  if (count === 0) {
    const email = process.env.ADMIN_EMAIL ?? "admin@wellnest.local"
    const password = process.env.ADMIN_PASSWORD ?? "wellnest2024"
    const hash = await hashPassword(password)
    db.prepare(
      "INSERT INTO admin_accounts (email, password_hash) VALUES (?, ?)"
    ).run(email, hash)
  }
}

// ─── IP-based rate limiting (stored in SQLite) ────────────────────────────────

/** Returns true if the IP is currently rate-limited (too many attempts). */
export function isRateLimited(ip: string): boolean {
  const db = getDb()
  const since = Date.now() - RATE_LIMIT_WINDOW_MS
  // clean up old records first
  db.prepare("DELETE FROM login_attempts WHERE attempted_at < ?").run(since)
  const { count } = db
    .prepare(
      "SELECT COUNT(*) as count FROM login_attempts WHERE ip = ? AND attempted_at >= ?"
    )
    .get(ip, since) as { count: number }
  return count >= RATE_LIMIT_MAX
}

/** Record a failed login attempt for the given IP. */
export function recordLoginAttempt(ip: string): void {
  const db = getDb()
  db.prepare(
    "INSERT INTO login_attempts (ip, attempted_at) VALUES (?, ?)"
  ).run(ip, Date.now())
}

/** Clear login attempts after a successful login. */
export function clearLoginAttempts(ip: string): void {
  const db = getDb()
  db.prepare("DELETE FROM login_attempts WHERE ip = ?").run(ip)
}

// ─── CSRF token helpers ───────────────────────────────────────────────────────

/**
 * Generates a secure CSRF token embedded in a short-lived JWT.
 * The token is set as a readable (non-httpOnly) cookie and also
 * submitted with the form in a header — double-submit cookie pattern.
 */
export async function generateCsrfToken(): Promise<string> {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  const raw = Buffer.from(buf).toString("hex")
  // Embed raw value in a signed JWT so it can be verified without state
  return new SignJWT({ csrf: raw })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getSecret())
}

/**
 * Verifies that the CSRF token in the request header matches
 * the one stored in the cookie (double-submit pattern).
 */
export async function validateCsrf(
  cookieToken: string | undefined,
  headerToken: string | undefined
): Promise<boolean> {
  if (!cookieToken || !headerToken) return false
  try {
    const [cookiePayload, headerPayload] = await Promise.all([
      jwtVerify(cookieToken, getSecret()),
      jwtVerify(headerToken, getSecret()),
    ])
    return (
      (cookiePayload.payload.csrf as string) ===
      (headerPayload.payload.csrf as string)
    )
  } catch {
    return false
  }
}

export { COOKIE_NAME, SESSION_DURATION_SECONDS }

