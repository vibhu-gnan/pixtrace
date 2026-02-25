'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRazorpayCheckout } from './razorpay-checkout';
import type { PlanData } from '@/types';

interface PricingCardProps {
  plan: PlanData;
  isLoggedIn: boolean;
  currentPlanId?: string;
}

export function PricingCard({ plan, isLoggedIn, currentPlanId }: PricingCardProps) {
  const router = useRouter();
  const { openCheckout } = useRazorpayCheckout();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isCurrentPlan = currentPlanId === plan.id;
  const isHighlighted = plan.id === 'pro';
  const isPaid = plan.id === 'starter' || plan.id === 'pro';
  const isEnterprise = plan.id === 'enterprise';
  const isFree = plan.id === 'free';

  const priceDisplay = plan.price_monthly > 0
    ? `₹${(plan.price_monthly / 100).toLocaleString('en-IN')}`
    : null;

  const handleClick = async () => {
    if (isCurrentPlan) return;

    if (isEnterprise) {
      router.push('/enterprise');
      return;
    }

    if (isFree) {
      router.push('/sign-up?plan=free');
      return;
    }

    // Paid plans
    if (!isLoggedIn) {
      router.push(`/sign-up?plan=${plan.id}`);
      return;
    }

    // Already logged in — open Razorpay checkout directly
    setLoading(true);
    setError('');
    try {
      const result = await openCheckout(plan.id);
      if (result.success) {
        router.push('/dashboard?welcome=true');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const getCtaText = () => {
    if (isCurrentPlan) return 'Current Plan';
    if (isFree) return 'Get Started Free';
    if (isEnterprise) return 'Contact Us';
    if (loading) return 'Processing...';
    return 'Subscribe';
  };

  return (
    <div
      className={`
        relative flex flex-col rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1
        ${isHighlighted
          ? 'bg-primary/10 border border-primary/30 shadow-[0_0_40px_rgba(43,108,238,0.15)] md:scale-105 z-10'
          : 'glass-panel hover:bg-white/5'
        }
      `}
    >
      {isHighlighted && (
        <div className="absolute -top-4 left-0 right-0 flex justify-center">
          <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg shadow-primary/40">
            Most Popular
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className={`text-xl font-medium mb-2 text-white`}>
          {plan.name}
        </h3>
        <p className={`text-sm h-10 ${isHighlighted ? 'text-blue-200/70' : 'text-slate-400'}`}>
          {plan.description}
        </p>
      </div>

      <div className="mb-8">
        <div className="flex items-baseline gap-1">
          {priceDisplay ? (
            <>
              <span className={`font-bold ${isHighlighted ? 'text-4xl' : 'text-3xl'} text-white`}>
                {priceDisplay}
              </span>
              <span className={isHighlighted ? 'text-blue-200/60' : 'text-slate-500'}>
                /month
              </span>
            </>
          ) : isEnterprise ? (
            <span className="text-3xl font-bold text-white">Custom</span>
          ) : (
            <span className="text-3xl font-bold text-white">Free</span>
          )}
        </div>
      </div>

      <ul className="space-y-4 mb-8 flex-grow">
        {plan.features.map((feature, index) => (
          <li key={index} className={`flex items-start gap-3 ${isHighlighted ? 'text-white' : 'text-slate-300'}`}>
            <span
              className={`material-icons text-xl ${
                isHighlighted
                  ? 'text-primary bg-white rounded-full p-[2px]'
                  : 'text-primary'
              }`}
              aria-hidden="true"
            >
              {isHighlighted ? 'check' : 'check_circle'}
            </span>
            <span className={isHighlighted && index < 2 ? 'font-medium' : ''}>
              {feature}
            </span>
          </li>
        ))}
      </ul>

      {error && (
        <p className="text-sm text-red-400 mb-3">{error}</p>
      )}

      <button
        onClick={handleClick}
        disabled={isCurrentPlan || loading}
        className={`
          w-full py-3 px-4 rounded-lg font-medium transition-all
          ${isCurrentPlan
            ? 'bg-slate-700 text-slate-400 cursor-default'
            : isHighlighted
              ? 'bg-primary text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:bg-blue-600 font-semibold'
              : 'border border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-white'
          }
          ${loading ? 'opacity-70 cursor-wait' : ''}
        `}
      >
        {getCtaText()}
      </button>
    </div>
  );
}
