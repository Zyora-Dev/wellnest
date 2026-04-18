import { NextResponse } from "next/server"
import getDb, { type Submission } from "@/lib/db"
import {
  WELLBEING_LABELS,
  FREQUENCY_LABELS,
  ENERGY_LABELS,
  PHQ_LABELS,
  SLEEP_HOURS_LABELS,
  SLEEP_QUALITY_LABELS,
  CONCENTRATION_LABELS,
  PRODUCTIVITY_LABELS,
  SUPPORT_LABELS,
  COMFORT_LABELS,
  RELAXATION_LABELS,
} from "@/lib/schema"

/** Safely escape a value for CSV output (RFC 4180). */
function toCSVCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

const CSV_HEADERS = [
  "ID",
  "Timestamp (UTC)",
  // S1
  "Overall Wellbeing",
  "Stress Frequency",
  "Energy Levels",
  // S2
  "Anxiety Frequency",
  "Low Mood Frequency",
  "Relaxation Difficulty",
  // S3
  "Sleep Quality",
  "Sleep Hours",
  "Wake Rested",
  // S4
  "Concentration Issues",
  "Productivity Level",
  // S5
  "Comfort Sharing",
  "Support System",
  "Loneliness Frequency",
  // S6
  "Coping Methods",
  "Relaxation Activities",
  // S7
  "Feeling Overwhelmed",
  "Wants Support Resources",
  // S8
  "Thoughts",
  "Additional Notes",
]

export async function GET() {
  try {
    const db = getDb()
    const rows = db
      .prepare("SELECT * FROM submissions ORDER BY created_at DESC")
      .all() as Submission[]

    const label =
      (map: Record<string, string>) =>
      (key: string | null | undefined): string =>
        key ? (map[key] ?? key) : ""

    const csvRows = rows.map((s) => [
      toCSVCell(s.id),
      toCSVCell(s.created_at),
      toCSVCell(label(WELLBEING_LABELS)(s.overall_wellbeing)),
      toCSVCell(label(FREQUENCY_LABELS)(s.stress_frequency)),
      toCSVCell(label(ENERGY_LABELS)(s.energy_levels)),
      toCSVCell(label(PHQ_LABELS)(s.anxiety_frequency)),
      toCSVCell(label(PHQ_LABELS)(s.low_mood_frequency)),
      toCSVCell(label(FREQUENCY_LABELS)(s.relaxation_difficulty)),
      toCSVCell(label(SLEEP_QUALITY_LABELS)(s.sleep_quality)),
      toCSVCell(label(SLEEP_HOURS_LABELS)(s.sleep_hours)),
      toCSVCell(label(FREQUENCY_LABELS)(s.wake_rested)),
      toCSVCell(label(CONCENTRATION_LABELS)(s.concentration_issues)),
      toCSVCell(label(PRODUCTIVITY_LABELS)(s.productivity_level)),
      toCSVCell(label(COMFORT_LABELS)(s.comfort_sharing)),
      toCSVCell(label(SUPPORT_LABELS)(s.support_system)),
      toCSVCell(label(FREQUENCY_LABELS)(s.loneliness_frequency)),
      toCSVCell(s.coping_methods),
      toCSVCell(label(RELAXATION_LABELS)(s.relaxation_activities)),
      toCSVCell(s.feeling_overwhelmed ?? ""),
      toCSVCell(
        s.wants_support_resources === null
          ? ""
          : s.wants_support_resources === 1
          ? "Yes"
          : "No"
      ),
      toCSVCell(s.thoughts),
      toCSVCell(s.additional_notes),
    ])

    const csv = [
      CSV_HEADERS.join(","),
      ...csvRows.map((r) => r.join(",")),
    ].join("\r\n")

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="wellnest-submissions-${timestamp}.csv"`,
        "Cache-Control": "no-store, no-cache",
      },
    })
  } catch (error) {
    console.error("[GET /api/admin/export]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

