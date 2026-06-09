import { createClient } from "@supabase/supabase-js"

import { getSupabaseUrl } from "@/lib/supabase/env"

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Document Vault requires Supabase Storage.`
    )
  }
  return value
}

let _serviceClient:
  | ReturnType<typeof createClient>
  | null = null

function getServiceClient() {
  if (_serviceClient) return _serviceClient

  // IMPORTANT: use normalized Supabase URL (strip /rest/v1 and trailing slash)
  const supabaseUrl = getSupabaseUrl()
  const supabaseServiceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")

  _serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return _serviceClient
}

const BUCKET_NAME = "documents"

export async function assertDocumentBucketExists(): Promise<{ error?: string }> {
  try {
    const supabase = getServiceClient()
    const { data, error } = await supabase.storage.listBuckets()
    if (error) throw error
    const bucket = data?.find((b) => b.name === BUCKET_NAME)
    if (!bucket) {
      return {
        error:
          `Supabase Storage bucket "${BUCKET_NAME}" was not found. ` +
          `Create it in Supabase → Storage, then apply RLS policies.`,
      }
    }
    return {}
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to verify storage bucket",
    }
  }
}

export async function uploadFile(
  file: File,
  path: string
): Promise<{ error?: string; data?: { path: string } }> {
  try {
    const supabase = getServiceClient()
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      })

    if (error) throw error

    return { data }
  } catch (error) {
    console.error("Upload error:", error)
    return { error: error instanceof Error ? error.message : "Upload failed" }
  }
}

export async function deleteFile(path: string): Promise<{ error?: string }> {
  try {
    const supabase = getServiceClient()
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path])

    if (error) throw error

    return {}
  } catch (error) {
    console.error("Delete error:", error)
    return { error: error instanceof Error ? error.message : "Delete failed" }
  }
}

export async function getSignedUrl(
  path: string,
  expiresIn: number = 3600
): Promise<{ error?: string; data?: { signedUrl: string } }> {
  try {
    const supabase = getServiceClient()
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, expiresIn)

    if (error) throw error

    return { data: { signedUrl: data.signedUrl } }
  } catch (error) {
    console.error("Signed URL error:", error)
    return { error: error instanceof Error ? error.message : "Failed to generate signed URL" }
  }
}

export async function createSignedUploadUrl(
  path: string,
  options?: { upsert?: boolean }
): Promise<{ error?: string; data?: { signedUrl: string; token: string; path: string } }> {
  try {
    const supabase = getServiceClient()
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(path, { upsert: !!options?.upsert })

    if (error) throw error

    return { data }
  } catch (error) {
    console.error("Signed upload URL error:", error)
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to create signed upload URL",
    }
  }
}

export async function moveFile(
  fromPath: string,
  toPath: string
): Promise<{ error?: string; data?: { path: string } }> {
  try {
    const supabase = getServiceClient()
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .move(fromPath, toPath)

    if (error) throw error

    return { data: { path: toPath } }
  } catch (error) {
    console.error("Move error:", error)
    return { error: error instanceof Error ? error.message : "Move failed" }
  }
}

export async function fileExists(
  fullPath: string
): Promise<{ error?: string; data?: { exists: boolean } }> {
  try {
    const supabase = getServiceClient()
    const parts = fullPath.split("/").filter(Boolean)
    const fileName = parts.pop()
    const folder = parts.join("/")
    if (!fileName) return { data: { exists: false } }

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(folder, { search: fileName, limit: 10 })

    if (error) throw error

    const exists = !!data?.some((obj) => obj.name === fileName)
    return { data: { exists } }
  } catch (error) {
    console.error("Exists check error:", error)
    return {
      error:
        error instanceof Error ? error.message : "Failed to verify file exists",
    }
  }
}

export async function getPublicUrl(path: string): Promise<{ error?: string; data?: { publicUrl: string } }> {
  try {
    const supabase = getServiceClient()
    const { data } = await supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path)

    return { data: { publicUrl: data.publicUrl } }
  } catch (error) {
    console.error("Public URL error:", error)
    return { error: error instanceof Error ? error.message : "Failed to get public URL" }
  }
}
