// CDN configuration for static assets and API responses
// This file configures CDN integration for better performance and scalability

export const cdnConfig = {
  enabled: process.env.CDN_ENABLED === "true",
  provider: process.env.CDN_PROVIDER || "cloudflare", // cloudflare, aws, vercel
  domain: process.env.CDN_DOMAIN || "",
  
  // Cache configuration
  cacheControl: {
    static: "public, max-age=31536000, immutable", // 1 year for static assets
    api: "public, max-age=300, s-maxage=600", // 5 minutes for API responses
    images: "public, max-age=86400", // 1 day for images
    documents: "public, max-age=3600", // 1 hour for documents
  },
  
  // Image optimization
  imageOptimization: {
    enabled: true,
    formats: ["webp", "avif", "jpg"],
    quality: 85,
    sizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  },
}

export function getCDNUrl(path: string, cacheType: "static" | "api" | "images" | "documents" = "static"): string {
  if (!cdnConfig.enabled || !cdnConfig.domain) {
    return path
  }
  
  const url = new URL(path, cdnConfig.domain)
  return url.toString()
}

export function getCacheControlHeader(cacheType: "static" | "api" | "images" | "documents"): string {
  return cdnConfig.cacheControl[cacheType]
}

export function getImageUrl(
  path: string,
  width?: number,
  height?: number,
  quality?: number
): string {
  if (!cdnConfig.enabled || !cdnConfig.domain) {
    return path
  }
  
  const url = new URL(path, cdnConfig.domain)
  
  if (width) url.searchParams.set("width", width.toString())
  if (height) url.searchParams.set("height", height.toString())
  if (quality) url.searchParams.set("quality", quality.toString())
  
  return url.toString()
}

// CDN cache invalidation
export async function invalidateCDNCache(paths: string[]): Promise<{ success: boolean; error?: string }> {
  if (!cdnConfig.enabled) {
    return { success: true }
  }
  
  try {
    // In production, integrate with your CDN provider's API
    // Example with Cloudflare:
    // const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${apiToken}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({ files: paths }),
    // })
    
    console.log("CDN cache invalidated for paths:", paths)
    return { success: true }
  } catch (error) {
    console.error("Failed to invalidate CDN cache:", error)
    return { success: false, error: "Failed to invalidate CDN cache" }
  }
}
