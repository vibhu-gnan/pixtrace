import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { EnterpriseInquiryForm } from '@/components/enterprise/inquiry-form';

export default function EnterprisePage() {
  return (
    <div className="bg-background-dark font-display text-white antialiased min-h-screen">
      <Navigation />

      {/* Background glows */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-10%] left-[30%] w-[600px] h-[600px] bg-primary/15 rounded-full blur-[150px] opacity-40"></div>
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] opacity-30"></div>
      </div>

      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-32 pb-20">
        {/* Header */}
        <div className="text-center mb-12">
          <Link href="/pricing" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors mb-6">
            <span className="material-icons text-sm">arrow_back</span>
            Back to pricing
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Enterprise Solution
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Tell us about your studio&apos;s needs and we&apos;ll craft a custom plan with the right storage, features, and pricing just for you.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          {[
            { icon: 'storage', label: 'Unlimited Storage' },
            { icon: 'branding_watermark', label: 'White-label' },
            { icon: 'support_agent', label: 'Dedicated Support' },
            { icon: 'api', label: 'API Access' },
          ].map(({ icon, label }) => (
            <div key={label} className="glass-panel rounded-xl p-4 text-center">
              <span className="material-icons text-primary text-2xl">{icon}</span>
              <p className="text-xs text-slate-400 mt-2 font-medium">{label}</p>
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-white/5">
          <h2 className="text-xl font-semibold text-white mb-6">Tell us about your needs</h2>
          <EnterpriseInquiryForm />
        </div>
      </main>
    </div>
  );
}
