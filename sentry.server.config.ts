import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring — sample 10% in prod
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Don't send errors in development
  enabled: process.env.NODE_ENV === "production",

  environment: process.env.NODE_ENV,

  // Capture unhandled promise rejections
  integrations: [],

  beforeSend(event) {
    // Don't send expected auth errors (401s from expired sessions)
    if (event.tags?.["http.status_code"] === "401") {
      return null;
    }
    return event;
  },
});
