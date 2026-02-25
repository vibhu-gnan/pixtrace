'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const inquirySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address').max(255),
  phone: z.string().max(50).optional(),
  organization: z.string().max(255).optional(),
  category: z.enum(['wedding', 'corporate', 'sports', 'school', 'other']).optional(),
  eventsPerMonth: z.coerce.number().min(1).max(10000).optional(),
  photosPerEvent: z.coerce.number().min(1).max(1000000).optional(),
  additionalNeeds: z.string().max(2000).optional(),
});

export async function submitEnterpriseInquiry(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const raw = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    phone: (formData.get('phone') as string) || undefined,
    organization: (formData.get('organization') as string) || undefined,
    category: (formData.get('category') as string) || undefined,
    eventsPerMonth: formData.get('eventsPerMonth') ? formData.get('eventsPerMonth') : undefined,
    photosPerEvent: formData.get('photosPerEvent') ? formData.get('photosPerEvent') : undefined,
    additionalNeeds: (formData.get('additionalNeeds') as string) || undefined,
  };

  const parsed = inquirySchema.safeParse(raw);

  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return { error: firstError?.message || 'Please fill in all required fields correctly.' };
  }

  const supabase = createAdminClient();

  const { error } = await supabase.from('enterprise_inquiries').insert({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    organization: parsed.data.organization || null,
    category: parsed.data.category || null,
    events_per_month: parsed.data.eventsPerMonth || null,
    photos_per_event: parsed.data.photosPerEvent || null,
    additional_needs: parsed.data.additionalNeeds || null,
  });

  if (error) {
    console.error('Error submitting enterprise inquiry:', error);
    return { error: 'Failed to submit. Please try again or contact us directly.' };
  }

  return { success: true };
}
