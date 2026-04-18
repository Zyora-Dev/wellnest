"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  // Avoid hydration mismatch by only rendering after mount
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className="fixed top-4 right-4 z-50 h-10 w-10 rounded-full" />
    )
  }

  const isDark = resolvedTheme === "dark"

  return (
    <motion.button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.94 }}
      className="
        fixed top-4 right-4 z-50
        flex items-center justify-center
        h-10 w-10 rounded-full
        border border-white/30
        bg-white/70 dark:bg-slate-800/70
        backdrop-blur-md
        shadow-lg shadow-black/5 dark:shadow-black/30
        text-slate-600 dark:text-slate-300
        transition-colors duration-300
        hover:text-slate-900 dark:hover:text-white
      "
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="sun"
            initial={{ rotate: -45, opacity: 0, scale: 0.8 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 45, opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.22 }}
          >
            <Sun className="h-4 w-4" strokeWidth={2} />
          </motion.span>
        ) : (
          <motion.span
            key="moon"
            initial={{ rotate: 45, opacity: 0, scale: 0.8 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -45, opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.22 }}
          >
            <Moon className="h-4 w-4" strokeWidth={2} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
