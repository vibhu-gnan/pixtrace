'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useRazorpayCheckout } from '@/components/pricing/razorpay-checkout';

const PLAN_NAMES: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
};

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const planId = searchParams.get('plan') || '';
  const { openCheckout } = useRazorpayCheckout();
  const [status, setStatus] = useState<'loading' | 'opening' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!planId || !['starter', 'pro'].includes(planId)) {
      router.replace('/pricing');
      return;
    }

    // Small delay to let Razorpay script load
    const timer = setTimeout(async () => {
      setStatus('opening');
      try {
        const result = await openCheckout(planId);
        if (result.success) {
          router.replace('/dashboard?welcome=true');
        } else {
          // User dismissed the modal
          router.replace('/pricing');
        }
      } catch (err: any) {
        setError(err.message || 'Payment failed. Please try again.');
        setStatus('error');
      }
    }, 800);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const planName = PLAN_NAMES[planId] || planId;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-dark px-4">
      <div className="w-full max-w-md text-center space-y-6">
        {status === 'error' ? (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
              <span className="material-icons text-red-400 text-3xl">error_outline</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Payment Failed</h2>
            <p className="text-slate-400">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setStatus('loading'); setError(''); }}
                className="px-6 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-blue-600 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => router.replace('/pricing')}
                className="px-6 py-3 rounded-lg border border-slate-600 text-slate-300 hover:text-white transition-colors"
              >
                Back to Pricing
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              {status === 'loading' ? 'Setting up your subscription...' : `Opening ${planName} plan checkout`}
            </h2>
            <p className="text-slate-400">
              {status === 'loading'
                ? 'Please wait a moment.'
                : 'Complete the payment in the Razorpay window.'}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background-dark">
        <div className="text-slate-400">Loading...</div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
