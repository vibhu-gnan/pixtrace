'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { DashboardEventsClient } from './dashboard-events-client';

interface StatItem {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

interface DashboardPageContentProps {
  stats: StatItem[];
  events: any[];
  hasMore: boolean;
  searchQuery?: string;
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

export function DashboardPageContent({ stats, events, hasMore, searchQuery }: DashboardPageContentProps) {
  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants}>
      {/* Stats Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={itemVariants}
            className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3.5 shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${stat.color}`}>
              {stat.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-gray-900 leading-tight">{stat.value}</p>
              <p className="text-xs text-gray-400 font-medium">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Section header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-gray-900">My Events</h2>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Sort by:</span>
          <button className="inline-flex items-center gap-1 font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors">
            Newest First
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </motion.div>

      {/* Event cards grid */}
      <motion.div variants={itemVariants}>
        {events.length === 0 && searchQuery ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No events found</h3>
            <p className="text-sm text-gray-500">
              No events matching &ldquo;{searchQuery}&rdquo;
            </p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
            <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand-500" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No events yet</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
              Create your first event to start uploading photos and sharing galleries
            </p>
            <Link
              href="/events/new"
              className="inline-flex items-center px-5 py-2.5 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors shadow-sm"
            >
              Create Event
            </Link>
          </div>
        ) : (
          <DashboardEventsClient initialEvents={events} initialHasMore={hasMore} searchQuery={searchQuery} />
        )}
      </motion.div>
    </motion.div>
  );
}
