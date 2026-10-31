import { ZodError } from "zod";
import { LearningError } from "./errors";
import { requestSchema } from "./schema";
import { consumeBudget, processLearning, type LearningAction } from "./service";
import { limitedBytes } from "./transport";
import { BillingError, getBillingEntitlement } from "../billing";
import { DemoError } from "../demo";
import { setting } from "./config";

export async function handleLearningRequest(
  request: Request,
  action: LearningAction,
): Promise<Response> {
  try {
    const input = requestSchema.parse(await readJsonRequest(request));
    if (input.mode === "live") await authorizeLiveRequest(request, input.sessionId);
    return json(await processLearning(action, input, request.signal));
  } catch (error) {
    return learningErrorResponse(error);
  }
}

export async function readJsonRequest(request: Request): Promise<unknown> {
    if (
      !(request.headers.get("content-type") || "").includes("application/json")
    )
      throw new LearningError(
        "JSON_REQUIRED",
        "Send this request as JSON.",
        415,
      );
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new LearningError(
        "ORIGIN_REJECTED",
        "This request must come from ExplainIt Visually.",
        403,
      );
    if (!request.body)
      throw new LearningError(
        "INVALID_JSON",
        "The request was not valid JSON.",
        400,
      );
    const bytes = await limitedBytes(
      new Response(request.body, { headers: request.headers }),
      180 * 1024,
      { signal: request.signal, timeout: 15_000 },
    ).catch((error) => {
      if (error instanceof LearningError && error.code === "IMAGE_TOO_LARGE")
        throw new LearningError(
          "REQUEST_TOO_LARGE",
          "This lesson request is too large. Refresh the lesson and try again.",
          413,
        );
      throw error;
    });
    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new LearningError(
        "INVALID_JSON",
        "The request was not valid JSON.",
        400,
      );
    }
    return payload;
}

export async function authorizeLiveRequest(request: Request, sessionId?: string) {
  const testBilling =
    setting("BILLING_TEST_MODE") === "true" ||
    /^(?:sk|rk)_test_/.test(setting("STRIPE_SECRET_KEY"));
  if (testBilling) {
    const ownerId = setting("LIVE_GENERATION_OWNER_ID");
    // Sites supplies this identity at its trusted hosting boundary. A test
    // subscription must never authorize spending the owner's provider credits.
    if (
      !ownerId ||
      request.headers.get("oai-authenticated-user-id") !== ownerId
    )
      throw new LearningError(
        "TEST_GENERATION_RESTRICTED",
        "Live AI generation is reserved for the site owner during billing tests. You can explore the demo and test checkout.",
        403,
      );
  } else {
    const subscription = await getBillingEntitlement(request);
    if (!subscription.configured)
      throw new LearningError(
        "BILLING_NOT_CONFIGURED",
        "Live AI generation is unavailable until subscriptions are connected. You can explore the demo.",
        503,
      );
    if (!subscription.active)
      throw new LearningError(
        "SUBSCRIPTION_REQUIRED",
        "A monthly subscription is needed to create new AI lessons. You can continue exploring the demo.",
        402,
      );
  }
  // Server-supplied address is combined with the browser session; rotating client IDs cannot reset the address limit.
  const address = request.headers.get("cf-connecting-ip") || "local";
  consumeBudget(`address:${address}`);
  if (sessionId) consumeBudget(`session:${address}:${sessionId}`);
}

export function learningErrorResponse(error: unknown): Response {
  if (error instanceof ZodError)
    return json(
      {
        error:
          "Some lesson details were missing or too long. Refresh the lesson and try again.",
        code: "INVALID_INPUT",
      },
      400,
    );
  if (error instanceof BillingError)
    return json({ error: error.message, code: error.code }, error.status);
  if (error instanceof DemoError)
    return json({ error: error.message, code: "DEMO_TOPIC_UNAVAILABLE" }, 422);
  if (error instanceof LearningError)
    return json(
      { error: error.message, code: error.code },
      error.status,
      error.status === 429 ? { "Retry-After": "30" } : {},
    );
  // Do not include provider errors, credentials, prompts, or stack traces in responses.
  return json(
    {
      error: "This lesson could not be completed. Please try again.",
      code: "INTERNAL_ERROR",
    },
    500,
  );
}
export function json(
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}
