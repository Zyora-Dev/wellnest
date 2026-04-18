import { Heart } from "lucide-react"
import getDb, { type Submission } from "@/lib/db"
import DataTable from "@/components/DataTable"

// This is a Server Component — it reads the DB directly on the server.
export const dynamic = "force-dynamic"

export default function AdminDashboardPage() {
  const db = getDb()
  const submissions = db
    .prepare("SELECT * FROM submissions ORDER BY created_at DESC")
    .all() as Submission[]

  return (
    <main className="admin-bg min-h-svh">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Heart className="h-5 w-5 text-violet-500" strokeWidth={1.5} />
            <span className="text-xs font-semibold tracking-widest uppercase text-slate-400 dark:text-slate-500">
              Wellnest
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
            Submissions Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Browse, search, and export all mental health check-in submissions.
          </p>
        </div>

        {/* Data table (client component) */}
        <DataTable data={submissions} />
      </div>
    </main>
  )
}
