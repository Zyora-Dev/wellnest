import { NextRequest, NextResponse } from "next/server"
import getDb from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")?.trim() ?? ""
    const from = searchParams.get("from") // ISO date string
    const to = searchParams.get("to")     // ISO date string

    const db = getDb()

    let query = "SELECT * FROM submissions WHERE 1=1"
    const params: unknown[] = []

    if (from) {
      query += " AND created_at >= ?"
      params.push(from)
    }
    if (to) {
      query += " AND created_at <= ?"
      params.push(to + "T23:59:59Z")
    }
    if (search) {
      // Search in free-text fields
      query += " AND (thoughts LIKE ? OR coping_methods LIKE ? OR additional_notes LIKE ?)"
      const like = `%${search}%`
      params.push(like, like, like)
    }

    query += " ORDER BY created_at DESC"

    const submissions = db.prepare(query).all(...params)
    return NextResponse.json({ submissions })
  } catch (error) {
    console.error("[GET /api/admin/submissions]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

