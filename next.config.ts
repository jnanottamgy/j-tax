import type { NextConfig } from "next"
import { getSecurityHeaders } from "./lib/security/security-headers"

const isDev = process.env.NODE_ENV === "development"
const domain = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/https?:\/\//, "") ?? ""

const secHeaders = getSecurityHeaders({ isDev, domain })

// Convert Record<string,string> to Next.js header array format,
// skipping COEP which breaks third-party fonts and images
const SKIP_HEADERS = new Set(["Cross-Origin-Embedder-Policy"])
const headersList = Object.entries(secHeaders)
  .filter(([key]) => !SKIP_HEADERS.has(key))
  .map(([key, value]) => ({ key, value }))

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {
    root: process.cwd(),
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          ...headersList,
        ],
      },
    ]
  },

  async rewrites() {
    return []
  },

  poweredByHeader: false,
  serverExternalPackages: [],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
    unoptimized: false,
  },

  typescript: {
    ignoreBuildErrors: false,
  },
}

export default nextConfig
