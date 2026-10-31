import { billingErrorResponse, billingStatus } from "@/lib/billing";
import { getRuntimeEnv } from "@/lib/runtime-env";

export async function GET(request: Request) {
  try {
    const env = getRuntimeEnv();
    const testMode = String(env.BILLING_TEST_MODE ?? process.env.BILLING_TEST_MODE) === "true" || /^(?:sk|rk)_test_/.test(String(env.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY ?? ""));
    return Response.json({ ...await billingStatus(request), testMode }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return billingErrorResponse(error);
  }
}
