"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Loader2, Leaf, Lock } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Login failed")
      }
      router.push("/admin/dashboard")
    } catch (err: any) {
      toast.error(err.message ?? "Invalid credentials. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page-bg flex items-center justify-center px-4 min-h-svh">
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="glass-card w-full max-w-sm p-8"
      >
        {/* Header */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-emerald-500" strokeWidth={1.5} />
            <span className="text-xs font-semibold tracking-widest uppercase text-slate-400 dark:text-slate-500">
              Wellnest
            </span>
          </div>
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 mt-2">
            <Lock className="h-5 w-5 text-slate-500 dark:text-slate-400" strokeWidth={1.5} />
          </div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mt-1">Admin Login</h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            Sign in to access the submissions dashboard.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@wellnest.local"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/60 dark:bg-slate-800/60"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-white/60 dark:bg-slate-800/60"
            />
          </div>

          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white rounded-full mt-2 gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </main>
  )
}
