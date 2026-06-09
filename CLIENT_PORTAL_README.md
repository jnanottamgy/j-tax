# J-TAX Client Portal

## Overview

The J-TAX Client Portal is a dedicated interface for clients to access their tax-related information, documents, invoices, and communicate with their tax team. Built with a clean, simple, and mobile-friendly design that matches the premium SaaS aesthetic of J-TAX.

## Features

### ✅ Implemented Features

1. **Login** - Secure authentication via Supabase
2. **View Compliance Status** - Track all compliance filings and their status
3. **Upload Requested Documents** - Document management with categories
4. **View Invoices** - See all invoices with payment status
5. **View Payment History** - Track all payments made
6. **View Communication History** - Message history with tax team
7. **Download Files** - Download documents and invoices
8. **View Upcoming Deadlines** - Calendar view of compliance deadlines

### 🔒 Restrictions (RBAC)

- **Only their own data** - Clients can only see data associated with their client record
- **No access to internal records** - Clients cannot access internal notes, task assignments, or team communications

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Portal                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Client      │    │  Client      │    │  Client      │       │
│  │  Sidebar     │    │  Header      │    │  Dashboard   │       │
│  │              │    │              │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Compliance  │    │  Documents   │    │  Invoices    │       │
│  │  Page        │    │  Page        │    │  Page        │       │
│  │              │    │              │    │              │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐                            │
│  │  Messages    │    │  Deadlines   │                            │
│  │  Page        │    │  Page        │                            │
│  │              │    │              │                            │
│  └──────────────┘    └──────────────┘                            │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
j-tax/
├── app/
│   └── (client-portal)/
│       └── client/
│           ├── layout.tsx                    # Client portal layout with auth
│           ├── page.tsx                      # Client dashboard
│           ├── compliance/
│           │   └── page.tsx                  # Compliance status page
│           ├── documents/
│           │   └── page.tsx                  # Documents page with upload
│           ├── invoices/
│           │   └── page.tsx                  # Invoices & payments page
│           ├── messages/
│           │   └── page.tsx                  # Communication history page
│           └── deadlines/
│               └── page.tsx                  # Upcoming deadlines page
└── components/
    └── client-portal/
        ├── client-sidebar.tsx                # Sidebar navigation
        └── client-header.tsx                 # Header with notifications
```

## Pages

### 1. Dashboard (`/client`)

The main landing page for clients, showing:
- Quick stats (pending compliance, completed, overdue, outstanding amount)
- Upcoming deadlines (next 14 days)
- Recent documents
- Recent messages
- Outstanding invoices

### 2. Compliance (`/client/compliance`)

View all compliance filings with:
- Status badges (Pending, Completed, Overdue, Cancelled)
- Workflow status (Not Started, Documents Awaited, In Progress, Under Review, Filed, Completed, Overdue)
- Filing period information
- Filter by status

### 3. Documents (`/client/documents`)

Document management with:
- Upload area (drag & drop)
- Search functionality
- Category filters (GST, TDS, ROC, Audit, Income Tax, etc.)
- Download capability
- Confidential document indicators

### 4. Invoices (`/client/invoices`)

Invoice and payment management:
- Invoice list with status (Paid, Pending, Overdue, Partially Paid)
- Payment history
- Outstanding amount summary
- Pay now button (placeholder for payment integration)
- Download invoices

### 5. Messages (`/client/messages`)

Communication history:
- Message list with delivery status
- Compose new message
- Retry failed messages

### 6. Deadlines (`/client/deadlines`)

Deadline tracking:
- Overdue items
- Due today
- Due tomorrow
- This week
- Later
- Color-coded urgency indicators

## RBAC Implementation

### Authentication

```typescript
// In layout.tsx
const session = await getSession()
if (!session) redirect("/login")

// Only allow CLIENT role
if (session.user.role !== "CLIENT") {
  redirect("/")
}
```

### Data Isolation

```typescript
// Find the Client record for this user
const clientRecord = await prisma.client.findFirst({
  where: { email: session.user.email },
  select: { id: true, name: true },
})

// All queries are scoped to this client
const invoices = await prisma.invoice.findMany({
  where: { clientId: clientRecord.id },
  // ...
})
```

### Route Protection

The client portal routes are protected by:
1. Authentication requirement (getSession)
2. Role verification (must be CLIENT)
3. Data isolation (only client's own data)

## UI Design

### Design Principles

1. **Clean** - Minimal, uncluttered interface
2. **Simple** - Easy to navigate, clear actions
3. **Mobile-friendly** - Responsive design for all devices
4. **Premium SaaS** - Consistent with J-TAX brand

### Color Coding

- **Green** - Completed, paid, positive status
- **Yellow/Orange** - Pending, upcoming deadlines
- **Red** - Overdue, failed, urgent
- **Blue** - In progress, informational

### Components Used

- `Card` - Content containers
- `Badge` - Status indicators
- `Button` - Actions
- `Input` - Search fields
- `Sidebar` - Navigation

## Integration Points

### Notifications

The client portal integrates with the notification system:
- Notification bell in header
- Real-time updates via Supabase Realtime
- Sound notifications (optional)

### Documents

- Upload to Supabase Storage
- Download with signed URLs
- Category-based organization

### Messages

- WhatsApp integration (via existing Message model)
- Message status tracking (Pending, Sent, Delivered, Read, Failed)

## Future Enhancements

1. **Payment Integration** - Connect to payment gateway
2. **Document E-Signing** - Sign documents electronically
3. **Calendar View** - Visual calendar for deadlines
4. **Mobile App** - Native mobile application
5. **Push Notifications** - Browser/mobile push notifications
6. **Multi-language Support** - Internationalization
7. **Client Onboarding** - Guided setup for new clients