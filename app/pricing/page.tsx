'use client';

import { useState } from 'react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import type { PricingPlan } from '@/types';

const pricingPlans: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 2499,
    currency: '₹',
    interval: 'month',
    description: 'Perfect for photographers just getting started with online galleries.',
    features: [
      '10 GB Storage',
      'Up to 5 Events',
      'Original Quality Downloads',
      'Basic Analytics',
    ],
    highlighted: false,
    cta_text: 'Contact Us',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 4999,
    currency: '₹',
    interval: 'month',
    description: 'For busy professionals handling multiple clients and high volumes.',
    features: [
      '50 GB Storage',
      'Unlimited Events',
      'Custom Branding & Domain',
      'Priority Support',
      'Client Proofing',
    ],
    highlighted: true,
    cta_text: 'Contact Us',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 0,
    currency: '',
    interval: 'custom',
    description: 'Custom solutions for agencies and large scale studios.',
    features: [
      'Unlimited Storage',
      'White-label Solution',
      'Dedicated Account Manager',
      'API Access',
    ],
    highlighted: false,
    cta_text: 'Contact Us',
  },
];

const comparisonFeatures = [
  {
    feature: 'Storage Capacity',
    starter: '10 GB',
    pro: '50 GB',
    enterprise: 'Unlimited',
  },
  {
    feature: 'Active Events',
    starter: '5',
    pro: 'Unlimited',
    enterprise: 'Unlimited',
  },
  {
    feature: 'Custom Branding',
    starter: false,
    pro: true,
    enterprise: true,
  },
  {
    feature: 'Client Proofing',
    starter: false,
    pro: true,
    enterprise: true,
  },
  {
    feature: 'Watermarking',
    starter: 'Standard',
    pro: 'Custom',
    enterprise: 'Custom + AI',
  },
  {
    feature: 'Support Level',
    starter: 'Email',
    pro: 'Priority Email & Chat',
    enterprise: '24/7 Dedicated Agent',
  },
];

function PricingCard({ plan }: { plan: PricingPlan }) {
  const [showContactOptions, setShowContactOptions] = useState(false);

  const handleContactClick = () => {
    setShowContactOptions(true);
  };

  const handleEmailClick = () => {
    try {
      const subject = encodeURIComponent(`PIXTRACE Plan Inquiry - ${plan.name}`);
      window.location.href = `mailto:vtrader2005@gmail.com?subject=${subject}`;
    } catch (error) {
      console.error('Email client error:', error);
      alert('Unable to open email client. Please email us directly at vtrader2005@gmail.com');
    }
  };

  const handlePhoneClick = () => {
    window.location.href = 'tel:8688146351';
  };

  return (
    <div 
      className={`
        relative flex flex-col rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1
        ${plan.highlighted
          ? 'bg-primary/10 border border-primary/30 shadow-[0_0_40px_rgba(43,108,238,0.15)] md:scale-105 z-10'
          : 'glass-panel hover:bg-white/5'
        }
      `}
    >
      {plan.highlighted && (
        <div className="absolute -top-4 left-0 right-0 flex justify-center">
          <span className="bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg shadow-primary/40">
            Most Popular
          </span>
        </div>
      )}

      <div className="mb-6">
        <h3 className={`text-xl font-medium mb-2 ${plan.highlighted ? 'text-white' : 'text-white'}`}>
          {plan.name}
        </h3>
        <p className={`text-sm h-10 ${plan.highlighted ? 'text-blue-200/70' : 'text-slate-400'}`}>
          {plan.description}
        </p>
      </div>

      <div className="mb-8">
        <div className="flex items-baseline gap-1">
          {plan.price > 0 ? (
            <>
              <span className={`font-bold ${plan.highlighted ? 'text-4xl' : 'text-3xl'} text-white`}>
                {plan.currency}{plan.price.toLocaleString()}
              </span>
              <span className={plan.highlighted ? 'text-blue-200/60' : 'text-slate-500'}>
                /{plan.interval}
              </span>
            </>
          ) : (
            <span className="text-3xl font-bold text-white">Custom</span>
          )}
        </div>
      </div>

      <ul className="space-y-4 mb-8 flex-grow">
        {plan.features.map((feature, index) => (
          <li key={index} className={`flex items-start gap-3 ${plan.highlighted ? 'text-white' : 'text-slate-300'}`}>
            <span 
              className={`material-icons text-xl ${
                plan.highlighted 
                  ? 'text-primary bg-white rounded-full p-[2px]' 
                  : 'text-primary'
              }`}
              aria-hidden="true"
            >
              {plan.highlighted ? 'check' : 'check_circle'}
            </span>
            <span className={plan.highlighted && index < 2 ? 'font-medium' : ''}>
              {feature}
            </span>
          </li>
        ))}
      </ul>

      {!showContactOptions ? (
        <button
          onClick={handleContactClick}
          className={`
            w-full py-3 px-4 rounded-lg font-medium transition-all
            ${plan.highlighted
              ? 'bg-primary text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:bg-blue-600 font-semibold'
              : 'border border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-white'
            }
          `}
          aria-label={`Contact us about ${plan.name} plan`}
        >
          Contact Us
        </button>
      ) : (
        <div className="space-y-3">
          <button
            onClick={handleEmailClick}
            className="w-full py-3 px-4 rounded-lg border border-slate-600 bg-slate-800/50 text-white hover:bg-slate-700 transition-all font-medium flex items-center justify-center gap-2"
            aria-label="Email us about plan"
          >
            <span className="material-icons text-sm" aria-hidden="true">email</span>
            Email: vtrader2005@gmail.com
          </button>
          <button
            onClick={handlePhoneClick}
            className="w-full py-3 px-4 rounded-lg bg-primary text-white hover:bg-blue-600 transition-all font-semibold flex items-center justify-center gap-2"
            aria-label="Call us about plan"
          >
            <span className="material-icons text-sm" aria-hidden="true">phone</span>
            Call: 8688146351
          </button>
        </div>
      )}
    </div>
  );
}

function ComparisonTable() {
  return (
    <div className="max-w-5xl mx-auto mb-20 px-2 sm:px-0">
      <h2 className="text-2xl font-bold text-white text-center mb-10">Compare Features</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/30 backdrop-blur-sm -mx-2 sm:mx-0">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="p-4 pl-6 font-medium text-slate-400 w-1/3">Features</th>
              <th className="p-4 font-medium text-white text-center w-1/5">Starter</th>
              <th className="p-4 font-medium text-primary text-center w-1/5 bg-primary/5">Pro</th>
              <th className="p-4 font-medium text-white text-center w-1/5">Enterprise</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {comparisonFeatures.map((row, index) => (
              <tr 
                key={index}
                className={`
                  border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors
                  ${index === comparisonFeatures.length - 1 ? 'border-b-0' : ''}
                `}
              >
                <td className="p-4 pl-6 text-slate-300">{row.feature}</td>
                <td className="p-4 text-center">
                  {typeof row.starter === 'boolean' ? (
                    <span 
                      className={`material-icons text-lg ${
                        row.starter ? 'text-primary' : 'text-slate-600'
                      }`}
                      aria-hidden="true"
                    >
                      {row.starter ? 'check' : 'remove'}
                    </span>
                  ) : (
                    <span className={row.feature === 'Storage Capacity' ? 'text-slate-400' : 'text-slate-400'}>
                      {row.starter}
                    </span>
                  )}
                </td>
                <td className="p-4 text-center bg-primary/5">
                  {typeof row.pro === 'boolean' ? (
                    <span className="material-icons text-lg text-primary" aria-hidden="true">
                      {row.pro ? 'check' : 'remove'}
                    </span>
                  ) : (
                    <span className={row.feature === 'Storage Capacity' || row.feature === 'Active Events' ? 'text-white font-medium' : 'text-white'}>
                      {row.pro}
                    </span>
                  )}
                </td>
                <td className="p-4 text-center">
                  {typeof row.enterprise === 'boolean' ? (
                    <span 
                      className={`material-icons text-lg ${
                        row.enterprise ? 'text-primary' : 'text-slate-400'
                      }`}
                      aria-hidden="true"
                    >
                      {row.enterprise ? 'check' : 'remove'}
                    </span>
                  ) : (
                    <span className="text-slate-400">{row.enterprise}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomSolutionCTA() {
  const [showContactOptions, setShowContactOptions] = useState(false);

  const handleContactClick = () => {
    setShowContactOptions(true);
  };

  const handleEmailClick = () => {
    try {
      const subject = encodeURIComponent('PIXTRACE Custom Solution Inquiry');
      window.location.href = `mailto:vtrader2005@gmail.com?subject=${subject}`;
    } catch (error) {
      console.error('Email client error:', error);
      alert('Unable to open email client. Please email us directly at vtrader2005@gmail.com');
    }
  };

  const handlePhoneClick = () => {
    window.location.href = 'tel:8688146351';
  };

  const handleAPIDocs = () => {
    try {
      window.open('/docs/api', '_blank');
    } catch (error) {
      console.error('API docs failed:', error);
      window.location.href = '/docs';
    }
  };

  return (
    <div className="max-w-4xl mx-auto text-center py-16 px-4 rounded-2xl relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900 to-slate-800 border border-slate-700/50 rounded-2xl opacity-80 z-0" aria-hidden="true"></div>
      
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-full bg-primary/5 blur-3xl z-0 pointer-events-none" aria-hidden="true"></div>
      
      <div className="relative z-10">
        <h2 className="text-3xl font-bold text-white mb-4">Need a custom solution?</h2>
        <p className="text-slate-400 mb-8 max-w-xl mx-auto">
          We build tailored gallery experiences for high-volume studios and agencies. Let&apos;s discuss your specific needs.
        </p>
        
        {!showContactOptions ? (
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={handleContactClick}
              className="px-8 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-blue-600 transition-colors shadow-lg shadow-primary/20"
              aria-label="Contact us for custom solution"
            >
              Let&apos;s Talk
            </button>
            <button
              onClick={handleAPIDocs}
              className="px-8 py-3 rounded-lg border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 transition-colors font-medium"
              aria-label="View API documentation"
            >
              View API Docs
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={handleEmailClick}
              className="px-8 py-3 rounded-lg border border-slate-600 bg-slate-800/50 text-white hover:bg-slate-700 transition-all font-medium flex items-center justify-center gap-2"
              aria-label="Email us for custom solution"
            >
              <span className="material-icons text-sm" aria-hidden="true">email</span>
              Email: vtrader2005@gmail.com
            </button>
            <button
              onClick={handlePhoneClick}
              className="px-8 py-3 rounded-lg bg-primary text-white hover:bg-blue-600 transition-all font-semibold flex items-center justify-center gap-2"
              aria-label="Call us for custom solution"
            >
              <span className="material-icons text-sm" aria-hidden="true">phone</span>
              Call: 8688146351
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <ErrorBoundary>
      <div className="bg-background-light dark:bg-background-dark font-display text-slate-800 dark:text-slate-200 antialiased overflow-x-hidden">
        <Navigation />
        
        {/* Ambient Background Glows */}
        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] opacity-40"></div>
          <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[100px] opacity-30"></div>
        </div>

        <main className="relative z-10 flex-grow pt-28 pb-20 px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight leading-tight">
              Simple, transparent pricing for{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-300">
                pro photographers
              </span>
            </h1>
            <p className="text-lg text-slate-400">
              Choose the perfect plan to showcase your events. No hidden fees, cancel anytime.
            </p>
          </div>

          {/* Pricing Cards Grid */}
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mb-24 px-2 sm:px-0 relative">
            {pricingPlans.map((plan) => (
              <PricingCard key={plan.id} plan={plan} />
            ))}
          </div>

          {/* Comparison Table */}
          <ComparisonTable />

          {/* Custom Solution CTA */}
          <CustomSolutionCTA />
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800 bg-background-dark py-12 relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center gap-2 mb-4 md:mb-0">
                <div className="w-6 h-6 rounded-lg overflow-hidden">
                  <img 
                    src="/logo.png" 
                    alt="PIXTRACE Logo" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-slate-400 font-semibold text-sm tracking-tight">PIXTRACE</span>
              </div>
              <div className="flex space-x-6 text-sm text-slate-500">
                <Link 
                  className="hover:text-slate-300 transition-colors" 
                  href="/privacy"
                  aria-label="View privacy policy"
                >
                  Privacy
                </Link>
                <Link 
                  className="hover:text-slate-300 transition-colors" 
                  href="/terms"
                  aria-label="View terms of service"
                >
                  Terms
                </Link>
                <a 
                  className="hover:text-slate-300 transition-colors" 
                  href="https://twitter.com/pixtrace"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow PIXTRACE on Twitter"
                >
                  Twitter
                </a>
                <a 
                  className="hover:text-slate-300 transition-colors" 
                  href="https://instagram.com/pixtrace"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow PIXTRACE on Instagram"
                >
                  Instagram
                </a>
              </div>
              <div className="mt-4 md:mt-0 text-slate-600 text-sm">
                © 2023 PIXTRACE Inc.
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}
