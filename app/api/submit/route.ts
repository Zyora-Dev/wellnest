import { NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import getDb from "@/lib/db"
import { mentalHealthFormSchema } from "@/lib/schema"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const parsed = mentalHealthFormSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const d = parsed.data
    const id = uuidv4()
    const db = getDb()

    db.prepare(`
      INSERT INTO submissions (
        id,
        overall_wellbeing, stress_frequency, energy_levels,
        anxiety_frequency, low_mood_frequency, relaxation_difficulty,
        sleep_quality, sleep_hours, wake_rested,
        concentration_issues, productivity_level,
        comfort_sharing, support_system, loneliness_frequency,
        coping_methods, relaxation_activities,
        feeling_overwhelmed, wants_support_resources,
        thoughts, additional_notes
      ) VALUES (
        @id,
        @overallWellbeing, @stressFrequency, @energyLevels,
        @anxietyFrequency, @lowMoodFrequency, @relaxationDifficulty,
        @sleepQuality, @sleepHours, @wakeRested,
        @concentrationIssues, @productivityLevel,
        @comfortSharing, @supportSystem, @lonelinessFrequency,
        @copingMethods, @relaxationActivities,
        @feelingOverwhelmed, @wantsSupportResources,
        @thoughts, @additionalNotes
      )
    `).run({
      id,
      overallWellbeing: d.overallWellbeing,
      stressFrequency: d.stressFrequency,
      energyLevels: d.energyLevels,
      anxietyFrequency: d.anxietyFrequency,
      lowMoodFrequency: d.lowMoodFrequency,
      relaxationDifficulty: d.relaxationDifficulty,
      sleepQuality: d.sleepQuality,
      sleepHours: d.sleepHours,
      wakeRested: d.wakeRested,
      concentrationIssues: d.concentrationIssues,
      productivityLevel: d.productivityLevel,
      comfortSharing: d.comfortSharing,
      supportSystem: d.supportSystem,
      lonelinessFrequency: d.lonelinessFrequency,
      copingMethods: d.copingMethods ?? null,
      relaxationActivities: d.relaxationActivities,
      feelingOverwhelmed: d.feelingOverwhelmed ?? null,
      wantsSupportResources:
        d.wantsSupportResources === undefined
          ? null
          : d.wantsSupportResources
          ? 1
          : 0,
      thoughts: d.thoughts,
      additionalNotes: d.additionalNotes ?? null,
    })

    return NextResponse.json({ success: true, id }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/submit]", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

