// Email notification service
// This is a placeholder implementation that would integrate with an email service like SendGrid, AWS SES, or Resend

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    // Placeholder: In production, integrate with your email service
    // Example with Resend:
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // await resend.emails.send({
    //   from: options.from || 'noreply@jtax.com',
    //   to: options.to,
    //   subject: options.subject,
    //   html: options.html,
    //   text: options.text,
    // })

    console.log("Email would be sent:", {
      to: options.to,
      subject: options.subject,
    })

    return { success: true }
  } catch (error) {
    console.error("Failed to send email:", error)
    return { success: false, error: "Failed to send email" }
  }
}

export async function sendWelcomeEmail(email: string, name: string): Promise<{ success: boolean }> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to J-TAX</h1>
        </div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>Welcome to J-TAX, your comprehensive tax and compliance management platform.</p>
          <p>We're excited to have you on board. Here's what you can do:</p>
          <ul>
            <li>Manage your clients and their tax profiles</li>
            <li>Track compliance deadlines and tasks</li>
            <li>Generate and manage invoices</li>
            <li>Store and organize documents</li>
            <li>Communicate with clients via WhatsApp</li>
          </ul>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" class="button">Get Started</a>
          <p style="margin-top: 30px;">If you have any questions, feel free to reach out to our support team.</p>
          <p>Best regards,<br>The J-TAX Team</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({
    to: email,
    subject: "Welcome to J-TAX",
    html,
    text: `Welcome to J-TAX, ${name}! Your comprehensive tax and compliance management platform.`,
  })
}

export async function sendTaskAssignmentEmail(
  email: string,
  name: string,
  taskTitle: string,
  dueDate: string
): Promise<{ success: boolean }> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .task { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
        .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Task Assigned</h1>
        </div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>You have been assigned a new task:</p>
          <div class="task">
            <h3>${taskTitle}</h3>
            <p><strong>Due Date:</strong> ${dueDate}</p>
          </div>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/work-tracker" class="button">View Task</a>
          <p style="margin-top: 30px;">Please complete this task by the due date.</p>
          <p>Best regards,<br>The J-TAX Team</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({
    to: email,
    subject: `New Task: ${taskTitle}`,
    html,
    text: `You have been assigned a new task: ${taskTitle}. Due date: ${dueDate}`,
  })
}

export async function sendComplianceReminderEmail(
  email: string,
  name: string,
  complianceTitle: string,
  dueDate: string
): Promise<{ success: boolean }> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .compliance { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f59e0b; }
        .button { display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Compliance Reminder</h1>
        </div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>This is a reminder that the following compliance deadline is approaching:</p>
          <div class="compliance">
            <h3>${complianceTitle}</h3>
            <p><strong>Due Date:</strong> ${dueDate}</p>
          </div>
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/calendar" class="button">View Calendar</a>
          <p style="margin-top: 30px;">Please ensure this compliance task is completed on time.</p>
          <p>Best regards,<br>The J-TAX Team</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({
    to: email,
    subject: `Compliance Reminder: ${complianceTitle}`,
    html,
    text: `Compliance reminder: ${complianceTitle} is due on ${dueDate}`,
  })
}
