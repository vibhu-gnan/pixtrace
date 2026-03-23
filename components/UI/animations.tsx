'use client';

import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';

// ─── Page Fade-In ────────────────────────────────────────────
// Wraps page content with a subtle fade + slide-up on mount
export function PageTransition({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as const }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Fade In/Out wrapper ─────────────────────────────────────
// For conditional content that should fade in/out smoothly
export function FadeIn({
  children,
  show,
  className = '',
  duration = 0.2,
}: {
  children: React.ReactNode;
  show: boolean;
  className?: string;
  duration?: number;
}) {
  return (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Slide Fade ──────────────────────────────────────────────
// Fades + slides from a direction. Good for modals, sidebars, toasts
type SlideDirection = 'up' | 'down' | 'left' | 'right';

const slideOffsets: Record<SlideDirection, { x: number; y: number }> = {
  up: { x: 0, y: 16 },
  down: { x: 0, y: -16 },
  left: { x: 16, y: 0 },
  right: { x: -16, y: 0 },
};

export function SlideFade({
  children,
  show,
  direction = 'up',
  className = '',
  duration = 0.25,
}: {
  children: React.ReactNode;
  show: boolean;
  direction?: SlideDirection;
  className?: string;
  duration?: number;
}) {
  const offset = slideOffsets[direction];
  return (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          initial={{ opacity: 0, x: offset.x, y: offset.y }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: offset.x, y: offset.y }}
          transition={{ duration, ease: [0.25, 0.46, 0.45, 0.94] as const }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Scale Fade (for modals/dialogs) ─────────────────────────
export function ScaleFade({
  children,
  show,
  className = '',
}: {
  children: React.ReactNode;
  show: boolean;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] as const }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Modal Overlay (backdrop) ────────────────────────────────
export function ModalOverlay({
  show,
  onClick,
  className = '',
}: {
  show: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`fixed inset-0 bg-black/50 z-40 ${className}`}
          onClick={onClick}
        />
      )}
    </AnimatePresence>
  );
}

// ─── Stagger Container + Item ────────────────────────────────
// For lists/grids that should stagger-animate children
export function StaggerContainer({
  children,
  className = '',
  staggerDelay = 0.05,
}: {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Tab Content Transition ──────────────────────────────────
// Crossfade between tab panels using a key
export function TabContent({
  activeKey,
  children,
  className = '',
}: {
  activeKey: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeKey}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Slide Panel (for mobile sidebars) ───────────────────────
export function SlidePanel({
  children,
  show,
  side = 'left',
  className = '',
}: {
  children: React.ReactNode;
  show: boolean;
  side?: 'left' | 'right';
  className?: string;
}) {
  const x = side === 'left' ? '-100%' : '100%';
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ x }}
          animate={{ x: 0 }}
          exit={{ x }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
