import { NextRequest, NextResponse } from "next/server"
import {
  createSessionToken,
  ensureAdminAccount,
  isRateLimited,
  recordLoginAttempt,
  clearLoginAttempts,
  verifyPassword,
  generateCsrfToken,
  COOKIE_NAME,
  SESSION_DURATION_SECONDS,
} from "@/lib/auth"
import getDb from "@/lib/db"

// Seed the admin account on first request if it doesn't exist
let seeded = false

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  )
}

// POST /api/admin/login  — authenticate and issue session cookie
export async function POST(request: NextRequest) {
  if (!seeded) {
    await ensureAdminAccount()
    seeded = true
  }

  const ip = getClientIp(request)

  // Rate limiting — return 429 without revealing whether the account exists
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const { email, password } = body as Record<string, unknown>

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email ||
    !password
  ) {
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    )
  }

  const db = getDb()
  const account = db
    .prepare("SELECT * FROM admin_accounts WHERE email = ?")
    .get(email) as { id: number; password_hash: string } | undefined

  // Always run bcrypt.compare (even on a dummy hash) to prevent timing attacks
  const dummyHash =
    "$2b$12$dummyhashforinvalidemailsxxxxxxxxxxxxxxxxxxxxxxxxxx"
  const isValid = await verifyPassword(
    password,
    account?.password_hash ?? dummyHash
  )

  if (!account || !isValid) {
    recordLoginAttempt(ip)
    // Generic message — do NOT reveal whether the email exists
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    )
  }

  clearLoginAttempts(ip)

  const sessionToken = await createSessionToken(email)
  const csrfToken = await generateCsrfToken()

  const response = NextResponse.json({ success: true })

  // HttpOnly session cookie — not accessible from JS
  response.cookies.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
  })

  // Readable CSRF cookie — read by the browser and sent as a header
  response.cookies.set("wellnest_csrf", csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
  })

  return response
}

// DELETE /api/admin/login — logout (clear cookies)
export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete(COOKIE_NAME)
  response.cookies.delete("wellnest_csrf")
  return response
}

