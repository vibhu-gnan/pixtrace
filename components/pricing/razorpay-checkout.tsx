'use client';

import { useEffect, useRef, useCallback } from 'react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function useRazorpayCheckout() {
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (scriptLoaded.current || typeof window === 'undefined') return;
    if (document.querySelector('script[src*="checkout.razorpay.com"]')) {
      scriptLoaded.current = true;
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => { scriptLoaded.current = true; };
    document.body.appendChild(script);
  }, []);

  const openCheckout = useCallback(async (planId: string): Promise<{ success: boolean }> => {
    const res = await fetch('/api/subscription/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create subscription');

    return new Promise<{ success: boolean }>((resolve, reject) => {
      const options = {
        key: data.razorpayKeyId,
        subscription_id: data.subscriptionId,
        name: 'PIXTRACE',
        description: `${data.planName} Plan - Monthly`,
        prefill: {
          name: data.organizerName || '',
          email: data.organizerEmail || '',
        },
        theme: {
          color: '#2b6cee',
        },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch('/api/subscription/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            if (verifyRes.ok) {
              resolve({ success: true });
            } else {
              reject(new Error('Payment verification failed'));
            }
          } catch (err) {
            reject(err);
          }
        },
        modal: {
          ondismiss: () => resolve({ success: false }),
        },
      };

      if (!window.Razorpay) {
        reject(new Error('Razorpay SDK not loaded. Please refresh and try again.'));
        return;
      }

      const rzp = new window.Razorpay(options);
      rzp.open();
    });
  }, []);

  return { openCheckout };
}
