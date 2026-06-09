// Undo/Redo functionality for operations
// This provides a way to revert destructive actions

export interface UndoAction {
  type: string
  entityId: string
  previousState: any
  timestamp: number
}

const undoStack = new Map<string, UndoAction[]>()

export function pushToUndoStack(userId: string, action: UndoAction) {
  if (!undoStack.has(userId)) {
    undoStack.set(userId, [])
  }
  const stack = undoStack.get(userId)!
  stack.push(action)
  
  // Keep only last 50 actions
  if (stack.length > 50) {
    stack.shift()
  }
}

export function popFromUndoStack(userId: string): UndoAction | null {
  const stack = undoStack.get(userId)
  if (!stack || stack.length === 0) {
    return null
  }
  return stack.pop()!
}

export function getUndoStack(userId: string): UndoAction[] {
  return undoStack.get(userId) || []
}

export function clearUndoStack(userId: string) {
  undoStack.delete(userId)
}

// Helper to create undo actions for common operations
export function createDeleteUndoAction(
  entityType: string,
  entityId: string,
  previousState: any
): UndoAction {
  return {
    type: `DELETE_${entityType.toUpperCase()}`,
    entityId,
    previousState,
    timestamp: Date.now(),
  }
}

export function createUpdateUndoAction(
  entityType: string,
  entityId: string,
  previousState: any
): UndoAction {
  return {
    type: `UPDATE_${entityType.toUpperCase()}`,
    entityId,
    previousState,
    timestamp: Date.now(),
  }
}
