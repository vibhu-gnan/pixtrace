'use client';

import { useState } from 'react';

// ─── Toggle Component ────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-brand-500' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ─── Radio Group Component ───────────────────────────────────

function RadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
              value === opt.value
                ? 'border-brand-500'
                : 'border-gray-300'
            }`}
            onClick={() => onChange(opt.value)}
          >
            {value === opt.value && (
              <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />
            )}
          </div>
          <span className="text-sm text-gray-700">{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

// ─── Monitor / Phone icons ───────────────────────────────────

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

// ─── Main Component ──────────────────────────────────────────

export default function PermissionsPage() {
  const [downloadAccess, setDownloadAccess] = useState('everyone');
  const [allowDownloadRequest, setAllowDownloadRequest] = useState(false);
  const [viewAccess, setViewAccess] = useState('everyone');
  const [allowViewRequest, setAllowViewRequest] = useState(false);
  const [slideshowEnabled, setSlideshowEnabled] = useState(true);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Permissions</h1>

      <div className="max-w-3xl space-y-10">
        {/* Download Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-3">Download</h3>
            <RadioGroup
              name="download"
              options={[
                { value: 'everyone', label: 'Everyone' },
                { value: 'no_one', label: 'no one' },
              ]}
              value={downloadAccess}
              onChange={setDownloadAccess}
            />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-3">Allow download request?</h3>
            <div className="flex items-center gap-3">
              <Toggle checked={allowDownloadRequest} onChange={setAllowDownloadRequest} />
              <span className="text-sm text-gray-600">Yes</span>
            </div>
          </div>
        </div>

        {/* View Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-3">View</h3>
            <RadioGroup
              name="view"
              options={[
                { value: 'everyone', label: 'Everyone' },
                { value: 'bmu_id', label: 'BMU ID' },
                { value: 'no_one', label: 'no one' },
              ]}
              value={viewAccess}
              onChange={setViewAccess}
            />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-3">Allow view request?</h3>
            <div className="flex items-center gap-3">
              <Toggle checked={allowViewRequest} onChange={setAllowViewRequest} />
              <span className="text-sm text-gray-600">Yes</span>
            </div>
          </div>
        </div>

        {/* Slideshow Section */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3">Slideshow</h3>
          <div className="flex items-center gap-3 mb-2">
            <Toggle checked={slideshowEnabled} onChange={setSlideshowEnabled} />
            <span className="text-sm text-gray-600">Yes</span>
          </div>
          <p className="text-sm text-gray-400">
            Allow visitors to view the images in their collection as a slideshow.
          </p>
        </div>
      </div>

      {/* Desktop/Mobile preview icons */}
      <div className="flex items-center justify-center gap-3 mt-16">
        <button className="p-2 rounded-lg bg-brand-50 text-brand-500">
          <MonitorIcon />
        </button>
        <button className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
          <PhoneIcon />
        </button>
      </div>
    </div>
  );
}
