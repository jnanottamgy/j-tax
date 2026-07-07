/** Standard shape returned by server actions that mutate form data. */
export type FormActionState = {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  /** Optional human-readable success detail (overrides the caller's default toast). */
  message?: string
  /** Optional structured payload (e.g. one-time credentials) for the caller's UI. */
  data?: Record<string, unknown>
}

export const emptyFormState: FormActionState = {}
