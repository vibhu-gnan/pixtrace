import Razorpay from 'razorpay';

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
}

export interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export async function createRazorpayOrder(planId: string, userEmail: string) {
  try {
    const response = await fetch('/api/create-razorpay-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId,
        userEmail,
      }),
    });

    const order = await response.json();

    if (order.error) {
      throw new Error(order.error);
    }

    return order;
  } catch (error) {
    console.error('Razorpay order creation error:', error);
    throw error;
  }
}

export function initializeRazorpay(options: RazorpayOptions) {
  // Check if Razorpay is loaded
  if (typeof window === 'undefined' || !(window as any).Razorpay) {
    throw new Error('Razorpay SDK not loaded. Please refresh the page and try again.');
  }
  
  const rzp = new (window as any).Razorpay(options);
  return rzp;
}

export const pricingPlans = {
  starter: {
    id: 'starter',
    name: 'Starter Plan',
    price: 249900, // Price in paise (₹2,499)
    currency: 'INR',
    interval: 'year',
    description: 'PIXTRACE Starter Plan - Annual subscription',
  },
  pro: {
    id: 'pro',
    name: 'Pro Plan',
    price: 499900, // Price in paise (₹4,999)
    currency: 'INR',
    interval: 'year',
    description: 'PIXTRACE Pro Plan - Annual subscription',
  },
};
