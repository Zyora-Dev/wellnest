/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tell Next.js / Turbopack not to bundle better-sqlite3 on the server
  // (it is a native Node addon that must be required at runtime)
  serverExternalPackages: ["better-sqlite3"],
  // Declare an empty Turbopack config to suppress the
  // "webpack config but no turbopack config" build error in Next.js 16
  turbopack: {},
}

export default nextConfig
