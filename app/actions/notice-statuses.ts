/**
 * Notice status ladder — shared constant.
 *
 * Lives OUTSIDE app/actions/notices.ts because that file is a `"use server"`
 * module, and Next.js only allows async-function exports from such modules.
 * A plain runtime array there crashes the whole /notices route
 * ("A 'use server' file can only export async functions, found object").
 * This module has no directive, so both the server actions and the client
 * component can import the value safely.
 */
export const NOTICE_STATUSES = [
  "OPEN",
  "REPLY_DRAFTED",
  "REPLIED",
  "HEARING",
  "CLOSED_FAVOURABLE",
  "CLOSED_UNFAVOURABLE",
  "CLOSED_PARTIAL",
] as const

export type NoticeStatus = (typeof NOTICE_STATUSES)[number]
