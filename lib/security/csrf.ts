import { cookies } from "next/headers"

const CSRF_SECRET = process.env.CSRF_SECRET || "default-csrf-secret-change-in-production"

export async function generateCSRFToken(): Promise<string> {
  const timestamp = Date.now().toString()
  const random = Math.random().toString(36).substring(2)
  const token = Buffer.from(`${timestamp}:${random}`).toString("base64")
  
  const cookieStore = await cookies()
  cookieStore.set("csrf_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  })
  
  return token
}

export async function validateCSRFToken(token: string): Promise<boolean> {
  const cookieStore = await cookies()
  const storedToken = cookieStore.get("csrf_token")?.value
  
  if (!storedToken || !token) {
    return false
  }
  
  return storedToken === token
}

export async function getCSRFToken(): Promise<string> {
  const cookieStore = await cookies()
  const existingToken = cookieStore.get("csrf_token")?.value
  
  if (existingToken) {
    return existingToken
  }
  
  return generateCSRFToken()
}
