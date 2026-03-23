import * as Sentry from "@sentry/nextjs";

/**
 * Capture an error with optional context tags.
 * Use this in server actions, API routes, and try/catch blocks.
 */
export function captureError(
  error: unknown,
  context?: {
    /** Where the error originated (e.g., "upload", "webhook", "cron") */
    source?: string;
    /** Additional key-value data */
    extra?: Record<string, unknown>;
    /** User ID for associating errors */
    userId?: string;
    /** Error severity level */
    level?: "fatal" | "error" | "warning" | "info";
  }
) {
  const err = error instanceof Error ? error : new Error(String(error));

  Sentry.withScope((scope) => {
    if (context?.source) {
      scope.setTag("source", context.source);
    }
    if (context?.extra) {
      scope.setExtras(context.extra);
    }
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }
    if (context?.level) {
      scope.setLevel(context.level);
    }
    Sentry.captureException(err);
  });

  // Also log to console for Vercel logs
  console.error(`[${context?.source || "error"}]`, err.message, context?.extra || "");
}

/**
 * Capture a warning-level message (not an exception).
 * Use for degraded states that aren't failures.
 */
export function captureWarning(message: string, extra?: Record<string, unknown>) {
  Sentry.captureMessage(message, {
    level: "warning",
    extra,
  });
  console.warn(`[warning] ${message}`, extra || "");
}

/**
 * Wrap an async function with Sentry error capturing.
 * Useful for server actions and API handlers.
 */
export function withMonitoring<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  source: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureError(error, { source });
      throw error;
    }
  }) as T;
}
