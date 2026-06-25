// Billing and subscription management
// This is a placeholder implementation that would integrate with a payment gateway like Stripe

export interface SubscriptionPlan {
  id: string
  name: string
  price: number
  currency: string
  interval: "monthly" | "yearly"
  features: string[]
  maxClients: number
  maxUsers: number
  supportLevel: "basic" | "priority" | "dedicated"
}

export interface InvoiceData {
  id: string
  subscriptionId: string
  amount: number
  currency: string
  status: "pending" | "paid" | "failed" | "cancelled"
  dueDate: Date
  paidDate?: Date
  items: InvoiceItem[]
}

export interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 49,
    currency: "USD",
    interval: "monthly",
    features: [
      "Up to 50 clients",
      "Up to 5 users",
      "Basic compliance tracking",
      "Email support",
      "Standard reports",
    ],
    maxClients: 50,
    maxUsers: 5,
    supportLevel: "basic",
  },
  {
    id: "professional",
    name: "Professional",
    price: 149,
    currency: "USD",
    interval: "monthly",
    features: [
      "Up to 200 clients",
      "Up to 15 users",
      "Advanced compliance tracking",
      "Priority email support",
      "Custom reports",
      "API access",
      "WhatsApp integration",
    ],
    maxClients: 200,
    maxUsers: 15,
    supportLevel: "priority",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 499,
    currency: "USD",
    interval: "monthly",
    features: [
      "Unlimited clients",
      "Unlimited users",
      "Full compliance suite",
      "Dedicated support",
      "Custom integrations",
      "Advanced analytics",
      "White-label options",
      "SLA guarantee",
    ],
    maxClients: -1, // unlimited
    maxUsers: -1, // unlimited
    supportLevel: "dedicated",
  },
]

export function getPlanById(planId: string): SubscriptionPlan | undefined {
  return subscriptionPlans.find((plan) => plan.id === planId)
}

export function getPlanByClientCount(clientCount: number): SubscriptionPlan {
  if (clientCount <= 50) return subscriptionPlans[0]
  if (clientCount <= 200) return subscriptionPlans[1]
  return subscriptionPlans[2]
}

export async function createSubscription(
  userId: string,
  planId: string,
  paymentMethodId: string
): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
  try {
    // Placeholder: In production, integrate with Stripe
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
    // const subscription = await stripe.subscriptions.create({
    //   customer: customerId,
    //   items: [{ price: planId }],
    //   default_payment_method: paymentMethodId,
    // })

    console.log(`Subscription created for user ${userId} with plan ${planId}`)
    return { success: true, subscriptionId: `sub_${Date.now()}` }
  } catch (error) {
    console.error("Failed to create subscription:", error)
    return { success: false, error: "Failed to create subscription" }
  }
}

export async function cancelSubscription(
  subscriptionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Placeholder: In production, integrate with Stripe
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
    // await stripe.subscriptions.cancel(subscriptionId)

    console.log(`Subscription ${subscriptionId} cancelled`)
    return { success: true }
  } catch (error) {
    console.error("Failed to cancel subscription:", error)
    return { success: false, error: "Failed to cancel subscription" }
  }
}

export async function upgradeSubscription(
  subscriptionId: string,
  newPlanId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Placeholder: In production, integrate with Stripe
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
    // await stripe.subscriptions.update(subscriptionId, {
    //   items: [{ price: newPlanId }],
    // })

    console.log(`Subscription ${subscriptionId} upgraded to ${newPlanId}`)
    return { success: true }
  } catch (error) {
    console.error("Failed to upgrade subscription:", error)
    return { success: false, error: "Failed to upgrade subscription" }
  }
}

export async function generateInvoice(
  subscriptionId: string
): Promise<{ success: boolean; invoice?: InvoiceData; error?: string }> {
  try {
    // Placeholder: In production, integrate with Stripe
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
    // const invoice = await stripe.invoices.create({
    //   subscription: subscriptionId,
    // })

    const invoice: InvoiceData = {
      id: `inv_${Date.now()}`,
      subscriptionId,
      amount: 149,
      currency: "USD",
      status: "pending",
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      items: [
        {
          description: "Professional Plan (Monthly)",
          quantity: 1,
          unitPrice: 149,
          total: 149,
        },
      ],
    }

    return { success: true, invoice }
  } catch (error) {
    console.error("Failed to generate invoice:", error)
    return { success: false, error: "Failed to generate invoice" }
  }
}

export function calculateProratedAmount(
  currentPlan: SubscriptionPlan,
  newPlan: SubscriptionPlan,
  daysRemaining: number
): number {
  const dailyRate = newPlan.price / 30
  return Math.round(dailyRate * daysRemaining * 100) / 100
}
