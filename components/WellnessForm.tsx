"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { motion, AnimatePresence } from "framer-motion"
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Loader2,
  Heart,
  AlertTriangle,
  Phone,
} from "lucide-react"
import { toast } from "sonner"

import {
  mentalHealthFormSchema,
  type MentalHealthFormValues,
  SECTION_FIELDS,
  detectDistressSignals,
} from "@/lib/schema"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

// ─── Animation Variants ───────────────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 32, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.97,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 56 : -56, opacity: 0 }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: (dir: number) => ({
    x: dir < 0 ? 56 : -56,
    opacity: 0,
    transition: { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
}

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

// ─── Pill Radio helper ────────────────────────────────────────────────────────

type PillOption = { value: string; label: string }

function PillRadio({
  name,
  options,
  value,
  onChange,
  cols = 2,
}: {
  name: string
  options: PillOption[]
  value: string
  onChange: (v: string) => void
  cols?: 2 | 3 | 4
}) {
  const gridCols =
    cols === 4
      ? "grid-cols-2 sm:grid-cols-4"
      : cols === 3
      ? "grid-cols-3"
      : "grid-cols-2"

  return (
    <RadioGroup
      onValueChange={onChange}
      defaultValue={value}
      className={`grid ${gridCols} gap-2`}
    >
      {options.map((opt) => (
        <Label
          key={opt.value}
          htmlFor={`${name}-${opt.value}`}
          className={[
            "flex items-center justify-center rounded-xl border px-3 py-2.5 cursor-pointer text-sm font-medium transition-all duration-200 text-center leading-snug",
            value === opt.value
              ? "border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-500"
              : "border-slate-200 bg-white/60 text-slate-600 hover:border-violet-200 hover:bg-violet-50/40 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:border-violet-700",
          ].join(" ")}
        >
          <RadioGroupItem
            id={`${name}-${opt.value}`}
            value={opt.value}
            className="sr-only"
          />
          {opt.label}
        </Label>
      ))}
    </RadioGroup>
  )
}

// ─── Section config ───────────────────────────────────────────────────────────

const SECTIONS = [
  { label: "Basic Wellbeing" },
  { label: "Emotional State" },
  { label: "Sleep & Lifestyle" },
  { label: "Focus & Productivity" },
  { label: "Social & Support" },
  { label: "Coping & Habits" },
  { label: "Check-In" },
  { label: "Reflection" },
]

const TOTAL = SECTIONS.length

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MentalHealthForm() {
  const [section, setSection] = useState(1)
  const [direction, setDirection] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showDistressAlert, setShowDistressAlert] = useState(false)

  const form = useForm<MentalHealthFormValues>({
    resolver: zodResolver(mentalHealthFormSchema),
    defaultValues: {
      overallWellbeing: undefined,
      stressFrequency: undefined,
      energyLevels: undefined,
      anxietyFrequency: undefined,
      lowMoodFrequency: undefined,
      relaxationDifficulty: undefined,
      sleepQuality: undefined,
      sleepHours: undefined,
      wakeRested: undefined,
      concentrationIssues: undefined,
      productivityLevel: undefined,
      comfortSharing: undefined,
      supportSystem: undefined,
      lonelinessFrequency: undefined,
      copingMethods: "",
      relaxationActivities: undefined,
      feelingOverwhelmed: undefined,
      wantsSupportResources: undefined,
      thoughts: "",
      additionalNotes: "",
    },
  })

  const watchedValues = form.watch()

  const goNext = async () => {
    const fields = SECTION_FIELDS[section] as (keyof MentalHealthFormValues)[]
    if (fields.length > 0) {
      const valid = await form.trigger(fields)
      if (!valid) return
    }
    if (detectDistressSignals(watchedValues)) {
      setShowDistressAlert(true)
    }
    setDirection(1)
    setSection((s) => Math.min(s + 1, TOTAL))
  }

  const goBack = () => {
    setDirection(-1)
    setSection((s) => Math.max(s - 1, 1))
  }

  const onSubmit = async (values: MentalHealthFormValues) => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Submission failed")
      }
      setSubmitted(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong."
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <motion.div
        key="success"
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="glass-card w-full max-w-lg mx-auto p-10 flex flex-col items-center text-center gap-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 16, delay: 0.1 }}
        >
          <CheckCircle2 className="h-16 w-16 text-violet-500" strokeWidth={1.5} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="space-y-2"
        >
          <h2 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            Thank you for sharing.
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
            Your responses have been recorded. Remember — this is a
            <strong> self-reflection tool</strong>, not a medical diagnosis.
            If you&apos;re struggling, please reach out to a trusted person or
            professional.
          </p>
        </motion.div>
        {detectDistressSignals(watchedValues) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.55 }}
            className="w-full rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-300 text-left"
          >
            <div className="flex gap-2 items-start">
              <Phone className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold mb-1">You&apos;re not alone.</p>
                <p>
                  If you&apos;re feeling overwhelmed, consider calling a helpline
                  such as <strong>iCall: 9152987821</strong> or{" "}
                  <strong>Vandrevala Foundation: 1860-2662-345</strong>.
                </p>
              </div>
            </div>
          </motion.div>
        )}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <Button
            variant="outline"
            className="rounded-full px-6 border-slate-200 dark:border-slate-700 dark:text-slate-300"
            onClick={() => {
              form.reset()
              setSection(1)
              setSubmitted(false)
              setShowDistressAlert(false)
            }}
          >
            Start a new response
          </Button>
        </motion.div>
      </motion.div>
    )
  }

  // ── Form card ─────────────────────────────────────────────────────────────────
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="glass-card w-full max-w-lg mx-auto overflow-hidden"
    >
      {/* Disclaimer banner */}
      <div className="px-6 pt-5 pb-0">
        <div className="flex items-start gap-2 rounded-xl border border-violet-100 dark:border-violet-900/50 bg-violet-50/60 dark:bg-violet-950/30 px-4 py-3 text-xs text-violet-700 dark:text-violet-400">
          <Heart className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            This form is a <strong>self-reflection tool</strong>, not a medical
            diagnosis. Your answers are confidential.
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="px-8 pt-5 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <Heart className="h-4 w-4 text-violet-500" strokeWidth={1.5} />
          <span className="text-[11px] font-semibold tracking-widest uppercase text-slate-400 dark:text-slate-500">
            Wellnest
          </span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
          Mental Health Check-In
        </h1>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
          Section {section} of {TOTAL} — {SECTIONS[section - 1].label}
        </p>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500"
            animate={{ width: `${(section / TOTAL) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          />
        </div>

        {/* Step dots */}
        <div className="flex items-center gap-1.5 mt-2">
          {SECTIONS.map((_, i) => (
            <div
              key={i}
              className={[
                "h-1 rounded-full transition-all duration-300",
                i + 1 === section
                  ? "w-5 bg-violet-500"
                  : i + 1 < section
                  ? "w-2 bg-violet-300"
                  : "w-2 bg-slate-200 dark:bg-slate-700",
              ].join(" ")}
            />
          ))}
        </div>
      </div>

      {/* Distress alert (inline, while filling) */}
      <AnimatePresence>
        {showDistressAlert && (
          <motion.div
            key="distress"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-6 overflow-hidden"
          >
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                We noticed some signs of difficulty. You&apos;re not alone —
                consider speaking with someone you trust or a professional.{" "}
                <button
                  type="button"
                  onClick={() => setShowDistressAlert(false)}
                  className="underline font-medium"
                >
                  Dismiss
                </button>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form body */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-8 pb-8">
          <div className="relative min-h-[340px] overflow-hidden flex flex-col justify-between">
            <AnimatePresence mode="wait" custom={direction}>

              {/* Section 1 */}
              {section === 1 && (
                <motion.div key="s1" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                  <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5 pt-2">
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="overallWellbeing" render={({ field }) => (
                        <FormItem>
                          <FormLabel>How would you rate your overall wellbeing lately?</FormLabel>
                          <FormControl>
                            <PillRadio name="overallWellbeing" value={field.value ?? ""} onChange={field.onChange} cols={3}
                              options={[
                                { value: "very_good", label: "Very Good 🌟" },
                                { value: "good", label: "Good 🙂" },
                                { value: "neutral", label: "Neutral 😐" },
                                { value: "poor", label: "Poor 😔" },
                                { value: "very_poor", label: "Very Poor 😞" },
                              ]}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="stressFrequency" render={({ field }) => (
                        <FormItem>
                          <FormLabel>How often do you feel stressed?</FormLabel>
                          <FormControl>
                            <PillRadio name="stressFrequency" value={field.value ?? ""} onChange={field.onChange} cols={3}
                              options={[
                                { value: "never", label: "Never" },
                                { value: "rarely", label: "Rarely" },
                                { value: "sometimes", label: "Sometimes" },
                                { value: "often", label: "Often" },
                                { value: "always", label: "Always" },
                              ]}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="energyLevels" render={({ field }) => (
                        <FormItem>
                          <FormLabel>What are your typical energy levels?</FormLabel>
                          <FormControl>
                            <PillRadio name="energyLevels" value={field.value ?? ""} onChange={field.onChange} cols={4}
                              options={[
                                { value: "high", label: "High ⚡" },
                                { value: "moderate", label: "Moderate" },
                                { value: "low", label: "Low" },
                                { value: "very_low", label: "Very Low 🪫" },
                              ]}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}

              {/* Section 2 */}
              {section === 2 && (
                <motion.div key="s2" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                  <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5 pt-2">
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="anxietyFrequency" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Over the past 2 weeks, how often have you felt nervous or anxious?</FormLabel>
                          <FormControl>
                            <PillRadio name="anxietyFrequency" value={field.value ?? ""} onChange={field.onChange}
                              options={[
                                { value: "not_at_all", label: "Not at all" },
                                { value: "several_days", label: "Several days" },
                                { value: "nearly_every_day", label: "Nearly every day" },
                              ]}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="lowMoodFrequency" render={({ field }) => (
                        <FormItem>
                          <FormLabel>How often have you felt down, depressed, or hopeless?</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-white/60 dark:bg-slate-800/60">
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="not_at_all">Not at all</SelectItem>
                              <SelectItem value="several_days">Several days</SelectItem>
                              <SelectItem value="more_than_half_days">More than half the days</SelectItem>
                              <SelectItem value="nearly_every_day">Nearly every day</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="relaxationDifficulty" render={({ field }) => (
                        <FormItem>
                          <FormLabel>How often do you find it difficult to relax or unwind?</FormLabel>
                          <FormControl>
                            <PillRadio name="relaxationDifficulty" value={field.value ?? ""} onChange={field.onChange} cols={4}
                              options={[
                                { value: "never", label: "Never" },
                                { value: "sometimes", label: "Sometimes" },
                                { value: "often", label: "Often" },
                                { value: "always", label: "Always" },
                              ]}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}

              {/* Section 3 */}
              {section === 3 && (
                <motion.div key="s3" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                  <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5 pt-2">
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="sleepQuality" render={({ field }) => (
                        <FormItem>
                          <FormLabel>How would you rate your sleep quality?</FormLabel>
                          <FormControl>
                            <PillRadio name="sleepQuality" value={field.value ?? ""} onChange={field.onChange} cols={4}
                              options={[
                                { value: "very_good", label: "Very Good 😴" },
                                { value: "good", label: "Good 🙂" },
                                { value: "fair", label: "Fair 😐" },
                                { value: "poor", label: "Poor 😔" },
                              ]}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="sleepHours" render={({ field }) => (
                        <FormItem>
                          <FormLabel>How many hours do you typically sleep per night?</FormLabel>
                          <FormControl>
                            <PillRadio name="sleepHours" value={field.value ?? ""} onChange={field.onChange} cols={4}
                              options={[
                                { value: "less_than_5", label: "< 5 hrs" },
                                { value: "five_to_six", label: "5–6 hrs" },
                                { value: "six_to_eight", label: "6–8 hrs" },
                                { value: "more_than_8", label: "> 8 hrs" },
                              ]}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="wakeRested" render={({ field }) => (
                        <FormItem>
                          <FormLabel>How often do you wake up feeling rested?</FormLabel>
                          <FormControl>
                            <PillRadio name="wakeRested" value={field.value ?? ""} onChange={field.onChange} cols={3}
                              options={[
                                { value: "always", label: "Always" },
                                { value: "often", label: "Often" },
                                { value: "sometimes", label: "Sometimes" },
                                { value: "rarely", label: "Rarely" },
                                { value: "never", label: "Never" },
                              ]}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}

              {/* Section 4 */}
              {section === 4 && (
                <motion.div key="s4" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                  <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5 pt-2">
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="concentrationIssues" render={({ field }) => (
                        <FormItem>
                          <FormLabel>How often do you have trouble concentrating?</FormLabel>
                          <FormControl>
                            <PillRadio name="concentrationIssues" value={field.value ?? ""} onChange={field.onChange} cols={4}
                              options={[
                                { value: "not_at_all", label: "Not at all" },
                                { value: "several_days", label: "Several days" },
                                { value: "often", label: "Often" },
                                { value: "very_often", label: "Very often" },
                              ]}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="productivityLevel" render={({ field }) => (
                        <FormItem>
                          <FormLabel>How would you describe your recent productivity?</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="bg-white/60 dark:bg-slate-800/60">
                                <SelectValue placeholder="Select productivity level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="very_productive">Very productive</SelectItem>
                              <SelectItem value="moderate">Moderately productive</SelectItem>
                              <SelectItem value="slight">Slightly productive</SelectItem>
                              <SelectItem value="not_at_all">Not productive at all</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}

              {/* Section 5 */}
              {section === 5 && (
                <motion.div key="s5" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                  <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5 pt-2">
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="comfortSharing" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Are you comfortable sharing your feelings with others?</FormLabel>
                          <FormControl>
                            <PillRadio name="comfortSharing" value={field.value ?? ""} onChange={field.onChange}
                              options={[
                                { value: "yes", label: "Yes 🤝" },
                                { value: "sometimes", label: "Sometimes" },
                                { value: "no", label: "No 🔒" },
                              ]}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="supportSystem" render={({ field }) => (
                        <FormItem>
                          <FormLabel>How would you describe your support system?</FormLabel>
                          <FormControl>
                            <PillRadio name="supportSystem" value={field.value ?? ""} onChange={field.onChange} cols={4}
                              options={[
                                { value: "strong", label: "Strong 💪" },
                                { value: "moderate", label: "Moderate" },
                                { value: "low", label: "Limited" },
                                { value: "none", label: "None" },
                              ]}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="lonelinessFrequency" render={({ field }) => (
                        <FormItem>
                          <FormLabel>How often do you feel lonely?</FormLabel>
                          <FormControl>
                            <PillRadio name="lonelinessFrequency" value={field.value ?? ""} onChange={field.onChange} cols={3}
                              options={[
                                { value: "never", label: "Never" },
                                { value: "rarely", label: "Rarely" },
                                { value: "sometimes", label: "Sometimes" },
                                { value: "often", label: "Often" },
                                { value: "always", label: "Always" },
                              ]}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}

              {/* Section 6 */}
              {section === 6 && (
                <motion.div key="s6" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                  <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5 pt-2">
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="copingMethods" render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            What coping methods do you use?{" "}
                            <span className="text-slate-400 font-normal">(optional)</span>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="e.g. walking, journalling, talking to a friend, meditation…"
                              className="resize-none bg-white/60 dark:bg-slate-800/60 min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="relaxationActivities" render={({ field }) => (
                        <FormItem>
                          <FormLabel>How often do you engage in relaxation activities?</FormLabel>
                          <FormControl>
                            <PillRadio name="relaxationActivities" value={field.value ?? ""} onChange={field.onChange} cols={4}
                              options={[
                                { value: "regularly", label: "Regularly" },
                                { value: "occasionally", label: "Occasionally" },
                                { value: "rarely", label: "Rarely" },
                                { value: "never", label: "Never" },
                              ]}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}

              {/* Section 7 */}
              {section === 7 && (
                <motion.div key="s7" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                  <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5 pt-2">
                    <motion.div variants={fadeUp}>
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                        These questions are completely optional.
                      </p>
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="feelingOverwhelmed" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Are you currently feeling overwhelmed?</FormLabel>
                          <FormControl>
                            <PillRadio name="feelingOverwhelmed" value={field.value ?? ""} onChange={field.onChange}
                              options={[
                                { value: "yes", label: "Yes" },
                                { value: "sometimes", label: "Sometimes" },
                                { value: "no", label: "No" },
                              ]}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="wantsSupportResources" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Would you like to receive mental health support resources?</FormLabel>
                          <FormControl>
                            <PillRadio
                              name="wantsSupportResources"
                              value={field.value === undefined ? "" : field.value ? "yes" : "no"}
                              onChange={(v) => field.onChange(v === "yes")}
                              options={[
                                { value: "yes", label: "Yes, please 🙏" },
                                { value: "no", label: "No thanks" },
                              ]}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}

              {/* Section 8 */}
              {section === 8 && (
                <motion.div key="s8" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
                  <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5 pt-2">
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="thoughts" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Is there anything on your mind you would like to share?</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Share whatever feels right — there are no wrong answers here…"
                              className="resize-none bg-white/60 dark:bg-slate-800/60 min-h-[110px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                    <motion.div variants={fadeUp}>
                      <FormField control={form.control} name="additionalNotes" render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Any additional notes?{" "}
                            <span className="text-slate-400 font-normal">(optional)</span>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Anything else you would like us to know…"
                              className="resize-none bg-white/60 dark:bg-slate-800/60 min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}

            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-6 mt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="ghost"
                onClick={goBack}
                disabled={section === 1}
                className="gap-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>

              {section < TOTAL ? (
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    type="button"
                    onClick={goNext}
                    className="gap-1 bg-violet-600 hover:bg-violet-500 text-white rounded-full px-6"
                  >
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              ) : (
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="gap-2 bg-violet-600 hover:bg-violet-500 text-white rounded-full px-6"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Submit
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </form>
      </Form>
    </motion.div>
  )
}
