import WellnessForm from "@/components/WellnessForm"

export default function HomePage() {
  return (
    <main className="page-bg flex items-center justify-center px-4 py-16">
      {/* Extra mid-page orb — colour is handled by CSS dark/light vars */}
      <div className="pointer-events-none fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-purple-300/20 dark:bg-indigo-800/20 blur-3xl" />
      <div className="relative z-10 w-full max-w-lg">
        <WellnessForm />
      </div>
    </main>
  )
}
