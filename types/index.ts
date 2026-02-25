// Global type definitions for PIXTRACE

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  name: string;
  description?: string;
  date: string;
  location?: string;
  is_public: boolean;
  password?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  photos_count?: number;
}

export interface Photo {
  id: string;
  event_id: string;
  filename: string;
  original_url: string;
  thumbnail_url: string;
  file_size: number;
  width: number;
  height: number;
  uploaded_at: string;
}

export interface GallerySettings {
  allow_download: boolean;
  allow_upload: boolean;
  watermark_enabled: boolean;
  watermark_text?: string;
  theme: 'light' | 'dark' | 'auto';
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  status: number;
}

export interface NavigationItem {
  label: string;
  href: string;
  icon?: string;
  requiresAuth?: boolean;
}

export interface FeatureCard {
  title: string;
  description: string;
  icon: string;
  color: 'primary' | 'emerald' | 'purple' | 'orange';
  badge?: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  content: string;
  avatar: string;
  rating: number;
}

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year' | 'custom';
  description?: string;
  features: string[];
  highlighted?: boolean;
  cta_text: string;
}

// Plan & subscription types
export interface PlanData {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  currency: string;
  storage_limit_bytes: number;
  max_events: number;
  features: string[];
  feature_flags: Record<string, unknown>;
  razorpay_plan_id: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface SubscriptionData {
  id: string;
  organizer_id: string;
  plan_id: string;
  razorpay_subscription_id: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  cancel_at_period_end: boolean;
  grace_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentData {
  id: string;
  razorpay_payment_id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface EnterpriseInquiryFormData {
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  category?: 'wedding' | 'corporate' | 'sports' | 'school' | 'other';
  eventsPerMonth?: number;
  photosPerEvent?: number;
  additionalNeeds?: string;
}

// Error types
export interface PixtraceError {
  code: string;
  message: string;
  details?: any;
}

// Auth types
export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

// Form types
export interface SignInFormData {
  email: string;
  password: string;
}

export interface SignUpFormData {
  email: string;
  password: string;
  name: string;
}

export interface EventFormData {
  name: string;
  description?: string;
  date: string;
  location?: string;
  is_public: boolean;
  password?: string;
}

// Component Props
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: string;
  rightIcon?: string;
  fullWidth?: boolean;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: string;
  rightIcon?: string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// SEO types
export interface MetaData {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  canonical?: string;
}

// Analytics types
export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp: number;
}

export interface PageViewEvent extends AnalyticsEvent {
  event: 'page_view';
  properties: {
    page: string;
    referrer?: string;
    user_agent?: string;
  };
}

export interface ConversionEvent extends AnalyticsEvent {
  event: 'conversion';
  properties: {
    type: 'sign_up' | 'sign_in' | 'event_created' | 'photo_uploaded';
    value?: number;
    currency?: string;
  };
}
