export default function DesignPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Design</h1>

      <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
        <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-brand-500"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Coming Soon</h3>
        <p className="text-sm text-gray-400 max-w-xs mx-auto">
          Customize your gallery appearance, colors, fonts, and branding
        </p>
      </div>
    </div>
  );
}
