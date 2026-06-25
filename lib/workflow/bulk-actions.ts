// Bulk action utilities for operations on multiple entities

export interface BulkActionResult {
  success: boolean
  processed: number
  failed: number
  errors: Array<{ id: string; error: string }>
}

export async function executeBulkAction<T>(
  items: T[],
  action: (item: T) => Promise<void>,
  batchSize: number = 10
): Promise<BulkActionResult> {
  const result: BulkActionResult = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [],
  }

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    
    await Promise.allSettled(
      batch.map(async (item) => {
        try {
          await action(item)
          result.processed++
        } catch (error) {
          result.failed++
          result.errors.push({
            id: String((item as any).id || i),
            error: error instanceof Error ? error.message : "Unknown error",
          })
        }
      })
    )
  }

  result.success = result.failed === 0
  return result
}

export async function bulkDelete<T extends { id: string }>(
  items: T[],
  deleteFn: (id: string) => Promise<void>
): Promise<BulkActionResult> {
  return executeBulkAction(items, (item) => deleteFn(item.id))
}

export async function bulkUpdate<T extends { id: string }>(
  items: T[],
  updateFn: (id: string, data: Partial<T>) => Promise<void>,
  data: Partial<T>
): Promise<BulkActionResult> {
  return executeBulkAction(items, (item) => updateFn(item.id, data))
}

export async function bulkAssign<T extends { id: string }>(
  items: T[],
  assignFn: (id: string, assigneeId: string) => Promise<void>,
  assigneeId: string
): Promise<BulkActionResult> {
  return executeBulkAction(items, (item) => assignFn(item.id, assigneeId))
}

// Validation for bulk operations
export function validateBulkOperation(items: any[], maxItems: number = 100): { valid: boolean; error?: string } {
  if (items.length === 0) {
    return { valid: false, error: "No items selected" }
  }
  
  if (items.length > maxItems) {
    return { valid: false, error: `Cannot process more than ${maxItems} items at once` }
  }
  
  return { valid: true }
}
