import { getRuntimeEnv } from "@/lib/runtime-env";

export function GET(request: Request) {
  const userId = request.headers.get("oai-authenticated-user-id");
  const env = getRuntimeEnv();
  const setting = (key: string) => String(env[key] ?? process.env[key] ?? "").trim();
  const billingTestMode = setting("BILLING_TEST_MODE") === "true" || /^(?:sk|rk)_test_/.test(setting("STRIPE_SECRET_KEY"));
  const canGenerate = billingTestMode && !!setting("LIVE_GENERATION_OWNER_ID") && userId === setting("LIVE_GENERATION_OWNER_ID");
  return Response.json(
    {
      userId: userId || null,
      email: userId
        ? request.headers.get("oai-authenticated-user-email") || null
        : null,
      billingTestMode,
      canGenerate,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
