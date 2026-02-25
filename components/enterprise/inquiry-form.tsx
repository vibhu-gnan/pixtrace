'use client';

import { useActionState } from 'react';
import { submitEnterpriseInquiry } from '@/actions/enterprise';

const initialState = null;

export function EnterpriseInquiryForm() {
  const [state, action, isPending] = useActionState(submitEnterpriseInquiry, initialState);

  if (state?.success) {
    return (
      <div className="text-center space-y-6 py-12">
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
          <span className="material-icons text-primary text-4xl">mark_email_read</span>
        </div>
        <h2 className="text-3xl font-bold text-white">We&apos;ll be in touch!</h2>
        <p className="text-slate-400 max-w-md mx-auto text-lg">
          Thanks for reaching out. Our team will review your requirements and get back to you within 24 hours with a custom quote.
        </p>
        <div className="glass-panel rounded-xl p-4 inline-block text-sm text-slate-400">
          <span className="material-icons text-primary text-sm mr-1 align-middle">phone</span>
          Or call us directly: <a href="tel:8688146351" className="text-primary font-medium">8688146351</a>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      {state?.error && (
        <div className="rounded-lg bg-red-900/40 border border-red-500/40 p-4">
          <p className="text-sm text-red-300">{state.error}</p>
        </div>
      )}

      {/* Name & Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Full Name <span className="text-red-400">*</span>
          </label>
          <input
            name="name"
            type="text"
            required
            placeholder="Rahul Sharma"
            className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Email Address <span className="text-red-400">*</span>
          </label>
          <input
            name="email"
            type="email"
            required
            placeholder="rahul@studio.com"
            className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Phone & Organization */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Phone Number
          </label>
          <input
            name="phone"
            type="tel"
            placeholder="+91 98765 43210"
            className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Studio / Organization Name
          </label>
          <input
            name="organization"
            type="text"
            placeholder="Sharma Photography Studio"
            className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Primary Event Category
        </label>
        <select
          name="category"
          className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        >
          <option value="" className="bg-slate-800">Select a category...</option>
          <option value="wedding" className="bg-slate-800">Wedding Photography</option>
          <option value="corporate" className="bg-slate-800">Corporate Events</option>
          <option value="sports" className="bg-slate-800">Sports Events</option>
          <option value="school" className="bg-slate-800">School / College Events</option>
          <option value="other" className="bg-slate-800">Other</option>
        </select>
      </div>

      {/* Volume */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Events per Month
          </label>
          <select
            name="eventsPerMonth"
            className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          >
            <option value="" className="bg-slate-800">Select range...</option>
            <option value="5" className="bg-slate-800">1–5 events</option>
            <option value="10" className="bg-slate-800">6–10 events</option>
            <option value="20" className="bg-slate-800">11–20 events</option>
            <option value="50" className="bg-slate-800">21–50 events</option>
            <option value="100" className="bg-slate-800">50+ events</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Photos per Event (max)
          </label>
          <select
            name="photosPerEvent"
            className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          >
            <option value="" className="bg-slate-800">Select range...</option>
            <option value="500" className="bg-slate-800">Up to 500 photos</option>
            <option value="1000" className="bg-slate-800">Up to 1,000 photos</option>
            <option value="3000" className="bg-slate-800">Up to 3,000 photos</option>
            <option value="5000" className="bg-slate-800">Up to 5,000 photos</option>
            <option value="10000" className="bg-slate-800">5,000+ photos</option>
          </select>
        </div>
      </div>

      {/* Additional needs */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          Additional Requirements
        </label>
        <textarea
          name="additionalNeeds"
          rows={4}
          placeholder="Tell us about any specific needs — white-label branding, custom domain, API access, face recognition, bulk downloads, etc."
          className="w-full px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-4 rounded-lg bg-primary text-white font-semibold text-base hover:bg-blue-600 transition-all shadow-lg shadow-primary/20 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? 'Submitting...' : 'Request Custom Quote'}
      </button>

      <p className="text-center text-xs text-slate-500">
        We typically respond within 24 hours. No spam, ever.
      </p>
    </form>
  );
}
