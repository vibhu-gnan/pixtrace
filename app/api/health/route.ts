import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Health check endpoint for uptime monitors.
 * GET /api/health
 *
 * Checks: app running, Supabase reachable, R2 configured.
 * Returns 200 if healthy, 503 if degraded.
 */
export async function GET() {
  const checks: Record<string, "ok" | "fail"> = {
    app: "ok",
    database: "fail",
    storage: "fail",
  };

  // Check Supabase connectivity
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("organizers").select("id").limit(1);
    if (!error) checks.database = "ok";
  } catch {
    // database check failed
  }

  // Check R2 configuration
  try {
    if (
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME
    ) {
      checks.storage = "ok";
    }
  } catch {
    // storage check failed
  }

  const healthy = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
    },
    { status: healthy ? 200 : 503 }
  );
}
