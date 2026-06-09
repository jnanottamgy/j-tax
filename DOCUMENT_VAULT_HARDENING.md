# Document Vault — Audit & Hardening Notes

## What’s verified/implemented in code

- **Supabase Storage configuration checks**: server actions verify the `documents` bucket exists (and surface a clear error if not).
- **Upload**: hardened allowlist (PDF, images, **DOCX**, **XLSX**) + max size (default **25 MB**, configurable via `DOCUMENT_MAX_FILE_SIZE_MB`).
- **Signed URLs**: download uses signed URLs; upload now supports **signed upload URLs** (enables progress tracking).
- **Delete**: deletes storage object (best-effort) + removes DB record.
- **Rename**: renames the stored object + updates DB metadata (and activity log).

## Security hardening

- **MIME type allowlist**: blocks archives and legacy Office formats (`.doc`, `.xls`) by default.
- **Extension checks**: file extension must match allowed MIME type.
- **Basic file signature checks (“magic bytes”)** for PDF and common image formats; OOXML files must be ZIP-like.
- **Virus-safe restriction (macro blocking)**: rejects OOXML containing `vbaProject.bin` (macro marker).

## Required environment + Supabase setup

1. `.env` must include:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-side storage operations)
2. Supabase Storage:
   - Create bucket: `documents`
   - Apply RLS policies appropriate to your tenant model (recommended: per-client access control).

## Manual test checklist (production readiness)

Upload each file type, confirm it appears in Document Vault, refresh the page, then download/delete/rename:
- PDF (`.pdf`)
- Excel (`.xlsx`)
- Word (`.docx`)
- Images (`.png`, `.jpg`, `.gif`, `.webp`)

Negative tests:
- Upload `> 25 MB` → should fail with size error.
- Upload `.docm` / `.xlsm` or macro-enabled OOXML → should fail with macro restriction.
- Upload `.zip` / `.exe` → should fail with “type not allowed”.

