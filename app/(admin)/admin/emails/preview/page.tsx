import Link from 'next/link';
import { welcomeSubject, welcomeHtml } from '@/lib/email/templates/welcome';
import { storageWarningSubject, storageWarningHtml } from '@/lib/email/templates/storage-warning';
import { storageDeletedSubject, storageDeletedHtml } from '@/lib/email/templates/storage-deleted';
import { planChangeSubject, planChangeHtml } from '@/lib/email/templates/plan-change';

// ─── Sample data for each template ─────────────────────────

const TEMPLATES = {
  welcome: {
    label: 'Welcome',
    subject: welcomeSubject(),
    html: welcomeHtml({ name: 'Rahul Sharma' }),
  },
  storage_warning: {
    label: 'Storage Warning',
    subject: storageWarningSubject(),
    html: storageWarningHtml({
      name: 'Rahul Sharma',
      usedDisplay: '1.8 GB',
      limitDisplay: '1 GB',
      overByDisplay: '820 MB',
      deadlineDate: '15 April 2026',
      planName: 'Free',
    }),
  },
  storage_deleted: {
    label: 'Storage Deleted',
    subject: storageDeletedSubject(3),
    html: storageDeletedHtml({
      name: 'Rahul Sharma',
      eventsDeleted: 3,
      bytesFreedDisplay: '920 MB',
      currentUsageDisplay: '880 MB',
      limitDisplay: '1 GB',
      planName: 'Free',
    }),
  },
  plan_change: {
    label: 'Plan Change',
    subject: planChangeSubject('upgrade'),
    html: planChangeHtml({
      name: 'Rahul Sharma',
      direction: 'upgrade',
      oldPlanName: 'Free',
      newPlanName: 'Pro',
      oldStorage: '1 GB',
      newStorage: '50 GB',
      oldMaxEvents: '1 event',
      newMaxEvents: 'Unlimited events',
      features: ['Original Quality Downloads', 'Custom Branding', 'Client Proofing'],
    }),
  },
} as const;

type TemplateKey = keyof typeof TEMPLATES;
const TEMPLATE_KEYS = Object.keys(TEMPLATES) as TemplateKey[];

function isValidTemplate(t: string): t is TemplateKey {
  return t in TEMPLATES;
}

// ─── Page ───────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{ template?: string }>;
}

export default async function EmailPreviewPage({ searchParams }: Props) {
  const params = await searchParams;
  const activeKey: TemplateKey = isValidTemplate(params.template || '') ? (params.template as TemplateKey) : 'welcome';
  const active = TEMPLATES[activeKey];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Email Template Preview</h1>
        <Link
          href="/admin/emails"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          &larr; Back to Logs
        </Link>
      </div>

      {/* Template selector */}
      <div className="flex flex-wrap gap-2">
        {TEMPLATE_KEYS.map((key) => {
          const isActive = key === activeKey;
          return (
            <Link
              key={key}
              href={`/admin/emails/preview?template=${key}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {TEMPLATES[key].label}
            </Link>
          );
        })}
      </div>

      {/* Subject line */}
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Subject</span>
        <p className="text-sm text-gray-900 mt-0.5">{active.subject}</p>
      </div>

      {/* Preview iframe */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <iframe
          srcDoc={active.html}
          title={`Preview: ${active.label}`}
          sandbox=""
          className="w-full border-0"
          style={{ height: '700px' }}
        />
      </div>

      <p className="text-xs text-gray-400 text-center">
        Rendered with sample data &middot; Actual emails use real user information
      </p>
    </div>
  );
}
