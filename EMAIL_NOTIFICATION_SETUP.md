# Email Notification Setup Guide

This guide explains how to configure and use the Email Notification system with Resend.

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Resend Email API Configuration
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=noreply@taxwiseconsultants.com
```

### Required Variables

- **RESEND_API_KEY**: Your Resend API key. Get this from [resend.com/api-keys](https://resend.com/api-keys)
- **FROM_EMAIL**: The email address to send emails from. This must be a verified domain in Resend.

## Getting a Resend API Key

1. Go to [resend.com](https://resend.com) and sign up for an account
2. Navigate to API Keys in the dashboard
3. Click "Create API Key"
4. Copy the API key and add it to your `.env` file

## Verifying Your Domain

1. In Resend dashboard, go to "Domains"
2. Click "Add Domain"
3. Enter your domain (e.g., `taxwiseconsultants.com`)
4. Add the DNS records provided by Resend to your domain's DNS settings
5. Wait for DNS propagation (usually takes a few minutes to a few hours)
6. Once verified, you can send emails from that domain

## Architecture

The email notification system follows this architecture:

```
Notification Service
    ↓
Provider Interface
    ↓
Resend Provider
```

This design allows for easy migration to other providers (WhatsApp, SMS) in the future.

## Available Notification Types

### Payment Reminders
Send payment reminders to clients for overdue invoices.

```typescript
await notificationService.sendPaymentReminder({
  to: "client@example.com",
  clientName: "John Doe",
  invoiceNumber: "INV-2024-0001",
  amount: "50,000",
  dueDate: "2024-06-15",
  daysOverdue: 5,
  paymentLink: "https://taxwiseconsultants.com/pay/INV-2024-0001"
})
```

### Compliance Reminders
Send compliance reminders for upcoming deadlines.

```typescript
await notificationService.sendComplianceReminder({
  to: "client@example.com",
  clientName: "John Doe",
  complianceType: "GSTR-1 Filing",
  dueDate: "2024-06-20",
  daysUntilDue: 3
})
```

### Document Requests
Request documents from clients.

```typescript
await notificationService.sendDocumentRequest({
  to: "client@example.com",
  clientName: "John Doe",
  serviceType: "GST Return Filing",
  documents: ["PAN Card", "GST Certificate", "Bank Statement"]
})
```

### Task Notifications
Notify employees about assigned tasks.

```typescript
await notificationService.sendTaskNotification({
  to: "employee@example.com",
  recipientName: "Jane Smith",
  taskTitle: "Prepare GSTR-1 Return",
  clientName: "John Doe",
  priority: "High",
  dueDate: "2024-06-18",
  description: "Prepare and file GSTR-1 return for the period April-May 2024"
})
```

## Email Templates

The system includes professionally branded HTML email templates for each notification type:

- **Payment Reminder**: Blue header with invoice details and payment link
- **Compliance Reminder**: Red header for urgent compliance deadlines
- **Document Request**: Green header with document list
- **Task Notification**: Purple header with task details

All templates use TaxWise Consultants branding with:
- Gradient header (blue to light blue)
- Professional typography
- Responsive design
- Clear call-to-action buttons

## Variable Substitution

Templates support variable substitution using `{{variable_name}}` syntax:

```typescript
// Template content
"Dear {{client_name}}, your invoice #{{invoice_number}} is due on {{due_date}}"

// Variables
{
  client_name: "John Doe",
  invoice_number: "INV-2024-0001",
  due_date: "2024-06-15"
}

// Result
"Dear John Doe, your invoice #INV-2024-0001 is due on 2024-06-15"
```

## Retry Logic

The notification service includes automatic retry logic with exponential backoff:

- **Max Retries**: 3 attempts (configurable)
- **Backoff Strategy**: Exponential (1s, 2s, 4s)
- **Attempt Tracking**: Each attempt is tracked in metadata

```typescript
await notificationService.send(
  {
    channel: "email",
    to: "client@example.com",
    subject: "Test",
    content: "Test message"
  },
  maxRetries: 5 // Override default of 3
)
```

## Delivery Tracking

Track delivery status of sent emails:

```typescript
const status = await notificationService.getStatus("email", "message-id")
console.log(status.status) // "sent", "delivered", "read", "failed", etc.
console.log(status.timestamp) // Delivery timestamp
```

## Integration with Existing System

The email notification system integrates with the existing message queue and logging:

- Messages are created with status "QUEUED"
- Status updates are logged in MessageLog
- Provider type is tracked in metadata
- External message IDs are stored for tracking

## Testing

Test the email notification system:

```typescript
import { notificationService } from "@/lib/messaging/notification-service"

// Test payment reminder
const result = await notificationService.sendPaymentReminder({
  to: "test@example.com",
  clientName: "Test Client",
  invoiceNumber: "TEST-001",
  amount: "1,000",
  dueDate: "2024-12-31",
  daysOverdue: 0
})

console.log(result)
```

## Troubleshooting

### Emails not sending
- Verify RESEND_API_KEY is set correctly
- Check that FROM_EMAIL domain is verified in Resend
- Check Resend dashboard for API errors
- Verify recipient email address is valid

### Domain verification failing
- Ensure DNS records are added correctly
- Wait for DNS propagation (can take up to 48 hours)
- Check for typos in DNS records
- Verify domain ownership

### Rate limiting
- Resend has rate limits based on your plan
- Implement queueing for high-volume sends
- Use bulk sending API for multiple recipients

## Future Enhancements

The architecture supports easy migration to other providers:

- **WhatsApp**: Implement WhatsAppProvider using the same interface
- **SMS**: Implement SMSProvider using Twilio or similar
- **Multi-channel**: Send notifications via multiple channels simultaneously

To add a new provider:

1. Implement the `NotificationProvider` interface
2. Register it in the NotificationService
3. Update the provider type enum

## Security Notes

- Never commit API keys to version control
- Use environment variables for sensitive data
- Rotate API keys regularly
- Monitor Resend dashboard for unusual activity
- Implement rate limiting to prevent abuse

## Support

For issues with Resend:
- Documentation: https://resend.com/docs
- Status Page: https://status.resend.com
- Support: support@resend.com
