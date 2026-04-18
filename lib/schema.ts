import { z } from "zod"

// ─── Section 1: Personal Information ──────────────────────────────────────────
const personalInfoSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be under 100 characters"),
  email: z
    .string()
    .email("Please enter a valid email address"),
  mobile: z
    .string()
    .regex(/^[0-9]{10}$/, "Please enter a valid 10-digit mobile number"),
  dateOfBirth: z
    .string()
    .min(1, "Please enter your date of birth"),
})

// ─── Section 2: Basic Wellbeing ───────────────────────────────────────────────
const basicWellbeingSchema = z.object({
  overallWellbeing: z.enum(
    ["very_good", "good", "neutral", "poor", "very_poor"],
    { required_error: "Please rate your overall wellbeing" }
  ),
  stressFrequency: z.enum(
    ["never", "rarely", "sometimes", "often", "always"],
    { required_error: "Please select how often you feel stressed" }
  ),
  energyLevels: z.enum(["high", "moderate", "low", "very_low"], {
    required_error: "Please select your typical energy level",
  }),
})

// ─── Section 2: Emotional State ───────────────────────────────────────────────
const emotionalStateSchema = z.object({
  anxietyFrequency: z.enum(
    ["not_at_all", "several_days", "nearly_every_day"],
    { required_error: "Please select how often you feel anxious" }
  ),
  lowMoodFrequency: z.enum(
    ["not_at_all", "several_days", "more_than_half_days", "nearly_every_day"],
    { required_error: "Please select how often you experience low mood" }
  ),
  relaxationDifficulty: z.enum(["never", "sometimes", "often", "always"], {
    required_error: "Please select how often you struggle to relax",
  }),
})

// ─── Section 3: Sleep & Lifestyle ────────────────────────────────────────────
const sleepLifestyleSchema = z.object({
  sleepQuality: z.enum(["very_good", "good", "fair", "poor"], {
    required_error: "Please rate your sleep quality",
  }),
  sleepHours: z.enum(
    ["less_than_5", "five_to_six", "six_to_eight", "more_than_8"],
    { required_error: "Please select your average sleep hours" }
  ),
  wakeRested: z.enum(["always", "often", "sometimes", "rarely", "never"], {
    required_error: "Please select how often you wake feeling rested",
  }),
})

// ─── Section 4: Focus & Productivity ─────────────────────────────────────────
const focusProductivitySchema = z.object({
  concentrationIssues: z.enum(
    ["not_at_all", "several_days", "often", "very_often"],
    { required_error: "Please select how often you have trouble concentrating" }
  ),
  productivityLevel: z.enum(
    ["very_productive", "moderate", "slight", "not_at_all"],
    { required_error: "Please select your productivity level" }
  ),
})

// ─── Section 5: Social & Support ─────────────────────────────────────────────
const socialSupportSchema = z.object({
  comfortSharing: z.enum(["yes", "no", "sometimes"], {
    required_error: "Please select your comfort with sharing feelings",
  }),
  supportSystem: z.enum(["strong", "moderate", "low", "none"], {
    required_error: "Please rate your support system",
  }),
  lonelinessFrequency: z.enum(
    ["never", "rarely", "sometimes", "often", "always"],
    { required_error: "Please select how often you feel lonely" }
  ),
})

// ─── Section 6: Coping & Habits ───────────────────────────────────────────────
const copingHabitsSchema = z.object({
  copingMethods: z
    .string()
    .max(500, "Please keep this under 500 characters")
    .optional(),
  relaxationActivities: z.enum(
    ["regularly", "occasionally", "rarely", "never"],
    { required_error: "Please select how often you do relaxation activities" }
  ),
})

// ─── Section 7: Optional Check-In ────────────────────────────────────────────
const optionalCheckInSchema = z.object({
  feelingOverwhelmed: z
    .enum(["yes", "no", "sometimes"])
    .optional(),
  wantsSupportResources: z.boolean().optional(),
})

// ─── Section 8: Reflection ────────────────────────────────────────────────────
const reflectionSchema = z.object({
  thoughts: z
    .string()
    .min(1, "Please share at least a brief thought")
    .max(2000, "Please keep this under 2000 characters"),
  additionalNotes: z
    .string()
    .max(1000, "Please keep this under 1000 characters")
    .optional(),
})

// ─── Combined Schema ──────────────────────────────────────────────────────────
export const mentalHealthFormSchema = personalInfoSchema
  .merge(basicWellbeingSchema)
  .merge(emotionalStateSchema)
  .merge(sleepLifestyleSchema)
  .merge(focusProductivitySchema)
  .merge(socialSupportSchema)
  .merge(copingHabitsSchema)
  .merge(optionalCheckInSchema)
  .merge(reflectionSchema)

export type MentalHealthFormValues = z.infer<typeof mentalHealthFormSchema>

// Per-section field lists for step-by-step validation
export const SECTION_FIELDS: Record<number, (keyof MentalHealthFormValues)[]> =
  {
    1: ["name", "email", "mobile", "dateOfBirth"],
    2: ["overallWellbeing", "stressFrequency", "energyLevels"],
    3: ["anxietyFrequency", "lowMoodFrequency", "relaxationDifficulty"],
    4: ["sleepQuality", "sleepHours", "wakeRested"],
    5: ["concentrationIssues", "productivityLevel"],
    6: ["comfortSharing", "supportSystem", "lonelinessFrequency"],
    7: ["copingMethods", "relaxationActivities"],
    8: [], // all optional
    9: ["thoughts"],
  }

// ─── Human-readable label maps ────────────────────────────────────────────────

export const WELLBEING_LABELS: Record<string, string> = {
  very_good: "Very Good",
  good: "Good",
  neutral: "Neutral",
  poor: "Poor",
  very_poor: "Very Poor",
}

export const FREQUENCY_LABELS: Record<string, string> = {
  never: "Never",
  rarely: "Rarely",
  sometimes: "Sometimes",
  often: "Often",
  always: "Always",
}

export const ENERGY_LABELS: Record<string, string> = {
  high: "High",
  moderate: "Moderate",
  low: "Low",
  very_low: "Very Low",
}

export const PHQ_LABELS: Record<string, string> = {
  not_at_all: "Not at all",
  several_days: "Several days",
  more_than_half_days: "More than half the days",
  nearly_every_day: "Nearly every day",
}

export const SLEEP_HOURS_LABELS: Record<string, string> = {
  less_than_5: "Less than 5 hrs",
  five_to_six: "5–6 hrs",
  six_to_eight: "6–8 hrs",
  more_than_8: "More than 8 hrs",
}

export const SLEEP_QUALITY_LABELS: Record<string, string> = {
  very_good: "Very Good",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
}

export const CONCENTRATION_LABELS: Record<string, string> = {
  not_at_all: "Not at all",
  several_days: "Several days",
  often: "Often",
  very_often: "Very often",
}

export const PRODUCTIVITY_LABELS: Record<string, string> = {
  very_productive: "Very productive",
  moderate: "Moderately productive",
  slight: "Slightly productive",
  not_at_all: "Not productive at all",
}

export const SUPPORT_LABELS: Record<string, string> = {
  strong: "Strong",
  moderate: "Moderate",
  low: "Low",
  none: "None",
}

export const COMFORT_LABELS: Record<string, string> = {
  yes: "Yes",
  no: "No",
  sometimes: "Sometimes",
}

export const RELAXATION_LABELS: Record<string, string> = {
  regularly: "Regularly",
  occasionally: "Occasionally",
  rarely: "Rarely",
  never: "Never",
}

// Distress signal detection — used to show supportive messaging
export function detectDistressSignals(
  values: Partial<MentalHealthFormValues>
): boolean {
  const highDistressValues = new Set([
    "very_poor",     // overallWellbeing
    "always",        // stressFrequency
    "very_low",      // energyLevels
    "nearly_every_day", // anxietyFrequency, lowMoodFrequency
    "more_than_half_days", // lowMoodFrequency
    "poor",          // sleepQuality
    "yes",           // feelingOverwhelmed
  ])
  return Object.values(values).some(
    (v) => typeof v === "string" && highDistressValues.has(v)
  )
}

