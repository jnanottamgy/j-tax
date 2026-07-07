// SERVER-ONLY MODULE — never import from a client component. The repo does not
// ship the `server-only` package, so this is enforced by convention: only
// `app/actions/*` server actions may import from here. The vault key must
// never reach the browser bundle.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

/**
 * AES-256-GCM sealing for client portal credentials.
 *
 * Sealed format: `${base64(iv)}.${base64(authTag)}.${base64(ciphertext)}`
 * — a fresh random 12-byte IV per seal, 16-byte GCM auth tag.
 *
 * Key: CREDENTIAL_VAULT_KEY env var, 64 hex chars (= 32 bytes).
 */

export const VAULT_KEY_ERROR = "CREDENTIAL_VAULT_KEY not configured"

function getVaultKey(): Buffer {
  const hex = process.env.CREDENTIAL_VAULT_KEY?.trim()
  // 64 hex chars = exactly 32 bytes = AES-256 key size. Anything else
  // (missing, truncated, non-hex) fails fast with a clear setup message.
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(VAULT_KEY_ERROR)
  }
  return Buffer.from(hex, "hex")
}

/** Encrypt a plaintext secret. Returns the sealed `iv.tag.cipher` string. */
export function sealSecret(plaintext: string): string {
  const key = getVaultKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return `${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`
}

/** Decrypt a sealed `iv.tag.cipher` string back to the plaintext secret. */
export function openSecret(sealed: string): string {
  const key = getVaultKey()
  const [ivB64, tagB64, cipherB64] = sealed.split(".")
  if (!ivB64 || !tagB64 || !cipherB64) {
    throw new Error("Malformed sealed secret")
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  return Buffer.concat([
    decipher.update(Buffer.from(cipherB64, "base64")),
    decipher.final(),
  ]).toString("utf8")
}
