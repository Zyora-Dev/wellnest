"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import {
  Download,
  LogOut,
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  Heart,
} from "lucide-react"
import { toast } from "sonner"

import type { Submission } from "@/lib/db"
import {
  WELLBEING_LABELS,
  FREQUENCY_LABELS,
  PHQ_LABELS,
  SLEEP_QUALITY_LABELS,
  SUPPORT_LABELS,
} from "@/lib/schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const PAGE_SIZE = 10

function wellbeingVariant(v: string): "success" | "warning" | "danger" {
  if (v === "very_good" || v === "good") return "success"
  if (v === "neutral") return "warning"
  return "danger"
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function DataTable({ data }: { data: Submission[] }) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  // Filter rows by search term (thoughts, coping methods, notes)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter(
      (r) =>
        r.thoughts?.toLowerCase().includes(q) ||
        r.coping_methods?.toLowerCase().includes(q) ||
        r.additional_notes?.toLowerCase().includes(q)
    )
  }, [data, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSearch = (v: string) => {
    setSearch(v)
    setPage(1)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch("/api/admin/export")
      if (!res.ok) throw new Error("Export failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const cd = res.headers.get("content-disposition") ?? ""
      const match = cd.match(/filename="?([^"]+)"?/)
      a.download = match?.[1] ?? "submissions.csv"
      a.click()
      URL.revokeObjectURL(url)
      toast.success("CSV downloaded successfully.")
    } catch {
      toast.error("Export failed. Please try again.")
    } finally {
      setExporting(false)
    }
  }

  const handleLogout = async () => {
    await fetch("/api/admin/login", { method: "DELETE" })
    router.push("/admin/login")
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search thoughts or notes…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 bg-white/70 dark:bg-slate-800/70"
          />
        </div>
        <div className="flex items-center gap-2">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button
              onClick={handleExport}
              disabled={exporting}
              className="gap-2 bg-violet-600 hover:bg-violet-500 text-white rounded-full"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          </motion.div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="gap-2 rounded-full border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      {/* Stats banner */}
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Heart className="h-4 w-4" />
        <span>
          {filtered.length} submission{filtered.length !== 1 ? "s" : ""}
          {search && ` matching "${search}"`}
        </span>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-white/40 dark:bg-white/5">
              <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-center">#</TableHead>
              <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Wellbeing</TableHead>
              <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Stress</TableHead>
              <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Anxiety</TableHead>
              <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Sleep</TableHead>
              <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Support</TableHead>
              <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Loneliness</TableHead>
              <TableHead className="font-semibold text-slate-700 dark:text-slate-300">Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center text-slate-400 dark:text-slate-500 py-12"
                >
                  No submissions found.
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((row, i) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  className="border-b transition-colors hover:bg-white/40 dark:hover:bg-white/5"
                >
                  <TableCell className="text-center text-slate-400 dark:text-slate-500 text-xs">
                    {row.id}
                  </TableCell>
                  <TableCell>
                    <Badge variant={wellbeingVariant(row.overall_wellbeing)}>
                      {WELLBEING_LABELS[row.overall_wellbeing] ?? row.overall_wellbeing}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 text-sm">
                    {FREQUENCY_LABELS[row.stress_frequency] ?? row.stress_frequency}
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 text-sm">
                    {PHQ_LABELS[row.anxiety_frequency] ?? row.anxiety_frequency}
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 text-sm">
                    {SLEEP_QUALITY_LABELS[row.sleep_quality] ?? row.sleep_quality}
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 text-sm">
                    {SUPPORT_LABELS[row.support_system] ?? row.support_system}
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 text-sm">
                    {FREQUENCY_LABELS[row.loneliness_frequency] ?? row.loneliness_frequency}
                  </TableCell>
                  <TableCell className="text-slate-400 dark:text-slate-500 text-xs whitespace-nowrap">
                    {formatDate(row.created_at)}
                  </TableCell>
                </motion.tr>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
