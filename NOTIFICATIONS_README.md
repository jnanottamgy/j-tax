# J-TAX Real-Time Notifications System

## Overview

The J-TAX notification system provides real-time, role-based notifications for task assignments, compliance deadlines, payments, invoices, and document uploads. Built with Supabase Realtime for live updates and featuring a polished UI with sound notifications.

## Features

### Notification Types

1. **Task Assigned** - When a task is assigned to a user
2. **Task Overdue** - When a task passes its due date
3. **Compliance Due** - Upcoming compliance deadline reminders
4. **Payment Received** - When a payment is received
5. **Invoice Overdue** - When an invoice passes its due date
6. **Document Uploaded** - When a document is uploaded

### Core Features

- **Real-time Updates** - Supabase Realtime for instant notification delivery
- **Notification Bell** - Dropdown in header with recent notifications
- **Unread Count Badge** - Live badge showing unread notification count
- **Mark as Read** - Individual or bulk mark as read
- **Archive** - Move notifications to archive
- **Notification History** - Full notification history with tabs
- **Sound Notifications** - Optional sound alert for new notifications
- **Toast Notifications** - Sonner toasts for real-time alerts
- **RBAC Compliance** - Role-based notification access

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Notification System                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Database    │    │  Server      │    │  Client      │       │
│  │  (Prisma)    │◄──►│  Actions     │◄──►│  Components  │       │
│  │              │    │              │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ Notification │    │ Notification │    │ Notification │       │
│  │ Model        │    │ Service      │    │ Provider     │       │
│  │              │    │              │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Supabase        │
                    │  Realtime        │
                    │  (Live Updates)  │
                    └──────────────────┘
```

## File Structure

```
j-tax/
├── prisma/
│   └── schema.prisma              # Notification model with types
├── app/
│   ├── actions/
│   │   └── notifications.ts       # Server actions for CRUD operations
│   └── (app)/
│       └── notifications/
│           ├── page.tsx           # Notifications page (server)
│           └── notifications-client.tsx  # Notifications page (client)
├── components/
│   ├── notifications/
│   │   ├── notifications-provider.tsx   # Context provider with realtime
│   │   └── notification-bell.tsx        # Bell icon with dropdown
│   └── dashboard/
│       └── dashboard-header.tsx   # Header with notification bell
└── lib/
    └── notifications/
        ├── index.ts               # Exports
        └── notification-service.ts # Service for creating notifications
```

## Database Schema

```prisma
enum NotificationType {
  TASK_ASSIGNED
  TASK_OVERDUE
  COMPLIANCE_DUE
  PAYMENT_RECEIVED
  INVOICE_OVERDUE
  DOCUMENT_UPLOADED
  INFO
  WARNING
  ALERT
}

enum NotificationEntityType {
  TASK
  COMPLIANCE
  INVOICE
  PAYMENT
  DOCUMENT
  CLIENT
  USER
}

model Notification {
  id          String                @id @default(cuid())
  userId      String
  user        User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  title       String
  message     String
  type        NotificationType      @default(INFO)
  entityType  NotificationEntityType?
  entityId    String?
  actionType  String?
  read        Boolean               @default(false)
  archived    Boolean               @default(false)
  createdAt   DateTime              @default(now())

  @@index([userId])
  @@index([read])
  @@index([archived])
  @@index([type])
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

## Usage

### Creating Notifications

Use the notification service to create notifications:

```typescript
import {
  notifyTaskAssigned,
  notifyTaskOverdue,
  notifyComplianceDue,
  notifyPaymentReceived,
  notifyInvoiceOverdue,
  notifyDocumentUploaded,
} from "@/lib/notifications"

// Task assigned
await notifyTaskAssigned({
  userId: "user-123",
  taskId: "task-456",
  taskTitle: "File GST Return",
  clientName: "ABC Corp",
  dueDate: new Date("2026-01-15"),
})

// Compliance due
await notifyComplianceDue({
  userId: "user-123",
  complianceId: "comp-789",
  complianceType: "GSTR-3B",
  clientName: "XYZ Ltd",
  dueDate: new Date("2026-01-20"),
  daysUntilDue: 5,
})

// Payment received
await notifyPaymentReceived({
  userId: "user-123",
  invoiceId: "inv-001",
  invoiceNumber: "INV-2026-001",
  clientName: "ABC Corp",
  amount: 50000,
  paymentMethod: "UPI",
})

// Document uploaded
await notifyDocumentUploaded({
  userId: "user-123",
  documentId: "doc-001",
  documentTitle: "GST Certificate",
  clientName: "ABC Corp",
  uploadedBy: "John Doe",
  category: "GST",
})
```

### Batch Notifications

```typescript
import { createNotificationsBatch } from "@/lib/notifications"

await createNotificationsBatch([
  {
    userId: "user-1",
    title: "System Update",
    message: "System will be updated tonight",
    type: "INFO",
  },
  {
    userId: "user-2",
    title: "System Update",
    message: "System will be updated tonight",
    type: "INFO",
  },
])
```

### Notify by Role

```typescript
import { notifyAllStaff, notifyUsersByRole } from "@/lib/notifications"

// Notify all staff
await notifyAllStaff({
  title: "Office Closure",
  message: "Office will be closed on Jan 26th",
  type: "INFO",
})

// Notify specific roles
await notifyUsersByRole({
  roles: ["PARTNER", "MANAGER"],
  title: "Review Required",
  message: "Q4 reports need review",
  type: "WARNING",
})
```

## RBAC Compliance

The notification system enforces role-based access control:

1. **Users only see their own notifications** - All queries filter by `userId`
2. **Mark as read/archive requires ownership** - Server actions verify user owns the notification
3. **Batch notifications restricted** - Only PARTNER and MANAGER roles can create bulk notifications
4. **Role-based targeting** - `notifyUsersByRole` allows targeting specific roles

## Real-time Updates

The system uses Supabase Realtime for live updates:

```typescript
// In notifications-provider.tsx
const channel = supabase
  .channel(`notifications:${user.id}`)
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "notifications",
      filter: `userId=eq.${user.id}`,
    },
    (payload) => {
      // Handle INSERT, UPDATE, DELETE events
      // Update UI optimistically
      // Show toast + optional sound
    }
  )
  .subscribe()
```

## Sound Notifications

Users can enable/disable sound notifications:

```typescript
// In notifications-provider.tsx
function playBeep() {
  const AudioContextImpl = window.AudioContext || window.webkitAudioContext
  const ctx = new AudioContextImpl()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = "sine"
  osc.frequency.value = 880
  gain.gain.value = 0.02
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  setTimeout(() => {
    osc.stop()
    ctx.close()
  }, 120)
}
```

Sound preference is stored in localStorage: `jtax.notifications.sound`

## UI Components

### Notification Bell

- Located in the dashboard header
- Shows unread count badge with pulse animation
- Dropdown with recent 10 notifications
- Quick actions: mark all read, view all
- Sound toggle in footer

### Notifications Page

- **Tabs**: All, Unread, Archived
- **Search**: Filter by title, message, or type
- **Type Filter**: Filter by notification type
- **Bulk Actions**: Mark all read, archive read
- **Individual Actions**: Mark read, archive, delete

## Migration

To apply the notification schema changes:

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Or create a migration
npx prisma migrate dev --name add_notification_types
```

## Testing

### Manual Testing

1. Log in as a user
2. Trigger a notification via the notification service
3. Verify:
   - Notification appears in bell dropdown
   - Unread count updates
   - Toast notification shows
   - Sound plays (if enabled)
   - Notification appears on notifications page
   - Mark as read works
   - Archive works

### Automated Testing

```typescript
// Example test
describe("Notification Service", () => {
  it("should create a task assigned notification", async () => {
    const result = await notifyTaskAssigned({
      userId: "test-user",
      taskId: "test-task",
      taskTitle: "Test Task",
      clientName: "Test Client",
    })

    expect(result.success).toBe(true)
    expect(result.notification.type).toBe("TASK_ASSIGNED")
  })
})
```

## Future Enhancements

1. **Email notifications** - Send email for critical notifications
2. **Push notifications** - Browser push notifications
3. **WhatsApp integration** - Send notifications via WhatsApp
4. **Notification preferences** - Per-user notification settings
5. **Scheduled digests** - Daily/weekly notification summaries
6. **Notification templates** - Customizable notification templates
7. **Snooze functionality** - Snooze notifications for later
8. **Notification categories** - Group notifications by category