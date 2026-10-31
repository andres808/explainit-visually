import assert from "node:assert/strict";
import test from "node:test";
import { GET as account } from "../app/api/account/route";
import { signBillingSession } from "../lib/billing";
import { LearningError } from "../lib/learning/errors";
import {
  authorizeLiveRequest,
  handleLearningRequest,
} from "../lib/learning/http";
import { handleIllustrationRequest } from "../lib/learning/illustrate";
import type { LearningAction } from "../lib/learning/service";
import { runWithRuntimeEnv } from "../lib/runtime-env";

const ownerId = "trusted-test-owner";
const visitorId = "c2634e58-6e62-4d9a-bf51-656de93701f8";
const sessionSecret = "unit-test-session-secret-at-least-32-characters";
const emptyBilling = {
  BILLING_TEST_MODE: "",
  LIVE_GENERATION_OWNER_ID: "",
  STRIPE_SECRET_KEY: "",
  STRIPE_PRICE_ID: "",
  STRIPE_WEBHOOK_SECRET: "",
  BILLING_SESSION_SECRET: "",
  APP_URL: "",
  BILLING_LOCAL_STORAGE: "false",
};

function request(path: string, userId?: string, cookie?: string) {
  return new Request(`https://learn.example${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://learn.example",
      "cf-connecting-ip": crypto.randomUUID(),
      ...(userId ? { "oai-authenticated-user-id": userId } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ mode: "live", question: "engine" }),
  });
}

function errorWith(code: string, status: number) {
  return (error: unknown) =>
    error instanceof LearningError &&
    error.code === code &&
    error.status === status;
}

function subscriptionDatabase(active: boolean) {
  const row = {
    id: visitorId,
    customer_id: "cus_unit",
    subscription_id: "sub_unit",
    price_id: "price_unit",
    status: active ? "active" : "past_due",
    paid_until: Math.floor(Date.now() / 1000) + 3600,
    active: active ? 1 : 0,
    observed_at: Date.now(),
  };
  return {
    prepare() {
      const statement = {
        bind(..._values: unknown[]) {
          return statement;
        },
        async first() {
          return row;
        },
        async run() {},
      };
      return statement;
    },
    async batch() {},
  };
}

function configuredBilling(active: boolean) {
  return {
    ...emptyBilling,
    STRIPE_SECRET_KEY: "rk_live_unit_test_only",
    STRIPE_PRICE_ID: "price_unit",
    STRIPE_WEBHOOK_SECRET: "whsec_unit_test_only",
    BILLING_SESSION_SECRET: sessionSecret,
    APP_URL: "https://learn.example",
    DB: subscriptionDatabase(active),
  };
}

test("test billing blocks anonymous, different-user, and missing-owner generation before any Stripe or provider work", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("Blocked requests must not reach any external service");
  };
  try {
    await runWithRuntimeEnv(
      {
        ...emptyBilling,
        BILLING_TEST_MODE: "true",
        LIVE_GENERATION_OWNER_ID: ownerId,
      },
      async () => {
        for (const identity of [undefined, "another-user"])
          await assert.rejects(
            authorizeLiveRequest(request("/api/learn", identity)),
            errorWith("TEST_GENERATION_RESTRICTED", 403),
          );

        const learningActions: LearningAction[] = [
          "learn", "explore", "ask", "style", "hotspots", "visualize",
        ];
        for (const action of learningActions) {
          const response = await handleLearningRequest(
            request(`/api/${action}`),
            action,
          );
          assert.equal(response.status, 403, action);
          assert.equal(
            (await response.json() as { code: string }).code,
            "TEST_GENERATION_RESTRICTED",
          );
        }
        const illustration = await handleIllustrationRequest(
          new Request("https://learn.example/api/illustrate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: "engine", style: "blueprint" }),
          }),
        );
        assert.equal(illustration.status, 403);
      },
    );
    await runWithRuntimeEnv(
      { ...emptyBilling, BILLING_TEST_MODE: "true" },
      async () => {
        await assert.rejects(
          authorizeLiveRequest(request("/api/learn", ownerId)),
          errorWith("TEST_GENERATION_RESTRICTED", 403),
        );
      },
    );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("test billing lets only the exact trusted owner generate while setup is incomplete", async () => {
  await runWithRuntimeEnv(
    {
      ...emptyBilling,
      BILLING_TEST_MODE: "true",
      LIVE_GENERATION_OWNER_ID: ownerId,
    },
    async () => {
      await assert.doesNotReject(
        authorizeLiveRequest(request("/api/learn", ownerId)),
      );
      await assert.rejects(
        authorizeLiveRequest(request("/api/learn", `${ownerId}-other`)),
        errorWith("TEST_GENERATION_RESTRICTED", 403),
      );
      await assert.rejects(
        authorizeLiveRequest(
          request(`/api/learn?owner=${ownerId}`, undefined, `owner=${ownerId}`),
        ),
        errorWith("TEST_GENERATION_RESTRICTED", 403),
      );
    },
  );
});

test("both restricted and secret test keys retain the owner restriction when the explicit flag is off", async () => {
  for (const testKey of ["rk_test_unit_test_only", "sk_test_unit_test_only"])
    await runWithRuntimeEnv(
      {
        ...emptyBilling,
        BILLING_TEST_MODE: "false",
        LIVE_GENERATION_OWNER_ID: ownerId,
        STRIPE_SECRET_KEY: testKey,
      },
      async () => {
        await assert.rejects(
          authorizeLiveRequest(request("/api/learn")),
          errorWith("TEST_GENERATION_RESTRICTED", 403),
        );
        await assert.doesNotReject(
          authorizeLiveRequest(request("/api/learn", ownerId)),
        );
      },
    );
});

test("an active test subscription cannot authorize a nonowner's provider spending", async () => {
  const signed = await signBillingSession(visitorId, sessionSecret);
  await runWithRuntimeEnv(
    {
      ...configuredBilling(true),
      BILLING_TEST_MODE: "true",
      LIVE_GENERATION_OWNER_ID: ownerId,
    },
    async () => {
      await assert.rejects(
        authorizeLiveRequest(
          request("/api/learn", "another-user", `explainit_billing=${signed}`),
        ),
        errorWith("TEST_GENERATION_RESTRICTED", 403),
      );
    },
  );
});

test("outside test mode generation fails closed without billing and requires an active verified subscription", async () => {
  await runWithRuntimeEnv(
    { ...emptyBilling, LIVE_GENERATION_OWNER_ID: ownerId },
    async () => {
      await assert.rejects(
        authorizeLiveRequest(request("/api/learn", ownerId)),
        errorWith("BILLING_NOT_CONFIGURED", 503),
      );
    },
  );
  const signed = await signBillingSession(visitorId, sessionSecret);
  await runWithRuntimeEnv(configuredBilling(false), async () => {
    await assert.rejects(
      authorizeLiveRequest(
        request("/api/learn", undefined, `explainit_billing=${signed}`),
      ),
      errorWith("SUBSCRIPTION_REQUIRED", 402),
    );
  });
  await runWithRuntimeEnv(configuredBilling(true), async () => {
    await assert.doesNotReject(
      authorizeLiveRequest(
        request("/api/learn", undefined, `explainit_billing=${signed}`),
      ),
    );
    await assert.rejects(
      authorizeLiveRequest(request("/api/learn", ownerId)),
      errorWith("SUBSCRIPTION_REQUIRED", 402),
    );
  });
});

test("owner test requests still obey the hourly provider request budget", async () => {
  await runWithRuntimeEnv(
    {
      ...emptyBilling,
      BILLING_TEST_MODE: "true",
      LIVE_GENERATION_OWNER_ID: ownerId,
      MAX_SESSION_REQUESTS: "1",
    },
    async () => {
      const ownerRequest = request("/api/learn", ownerId);
      await authorizeLiveRequest(ownerRequest);
      await assert.rejects(
        authorizeLiveRequest(ownerRequest),
        errorWith("SESSION_LIMIT", 429),
      );
    },
  );
});

test("anonymous curated demos remain available during public billing tests without provider calls", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("A curated demo must not call a provider");
  };
  try {
    await runWithRuntimeEnv(
      { ...emptyBilling, BILLING_TEST_MODE: "true" },
      async () => {
        const response = await handleLearningRequest(
          new Request("https://learn.example/api/learn", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "demo", question: "engine" }),
          }),
          "learn",
        );
        assert.equal(response.status, 200);
        assert.equal(
          (await response.json() as { node: { source: string } }).node.source,
          "demo",
        );
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("account discovery returns only the caller's trusted identity with no caching", async () => {
  await runWithRuntimeEnv(
    { LIVE_GENERATION_OWNER_ID: ownerId, BILLING_TEST_MODE: "true" },
    async () => {
      const anonymous = account(new Request("https://learn.example/api/account"));
      assert.deepEqual(await anonymous.json(), { userId: null, email: null, billingTestMode: true, canGenerate: false });
      assert.equal(anonymous.headers.get("Cache-Control"), "private, no-store");
      const signedIn = account(
        new Request("https://learn.example/api/account", {
          headers: {
            "oai-authenticated-user-id": "the-current-visitor",
            "oai-authenticated-user-email": "visitor@example.test",
          },
        }),
      );
      assert.deepEqual(await signedIn.json(), {
        userId: "the-current-visitor",
        email: "visitor@example.test",
        billingTestMode: true,
        canGenerate: false,
      });
      const owner = account(new Request("https://learn.example/api/account", { headers: { "oai-authenticated-user-id": ownerId } }));
      assert.equal((await owner.json() as { canGenerate: boolean }).canGenerate, true);
      assert.equal(signedIn.headers.get("Cache-Control"), "private, no-store");
    },
  );
});
