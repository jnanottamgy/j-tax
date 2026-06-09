/** Standard shape returned by server actions that mutate form data. */
export type FormActionState = {
  success?: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
}

export const emptyFormState: FormActionState = {}
