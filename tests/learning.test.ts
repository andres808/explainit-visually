import assert from "node:assert/strict";
import { test } from "node:test";
import { runWithRuntimeEnv } from "../lib/runtime-env";
import { demoNode } from "../lib/demo";
import type { LearningNode } from "../lib/types";
import { createCoalescer } from "../lib/learning/coalesce";
import { LearningError } from "../lib/learning/errors";
import { handleLearningRequest } from "../lib/learning/http";
import { consumeBudget, processLearning } from "../lib/learning/service";
import {
  isIdeogramImageUrl,
  persistProviderImage,
  readAsset,
} from "../lib/learning/storage";
import { providerFetch } from "../lib/learning/transport";
import { lessonContentSchema, requestSchema } from "../lib/learning/schema";
import { groundHotspots } from "../lib/learning/llm";
import { handleIllustrationRequest } from "../lib/learning/illustrate";

test("rejects image SSRF addresses and accepts only HTTPS Ideogram hosts", () => {
  for (const address of [
    "http://ideogram.ai/a.png",
    "https://ideogram.ai.evil.test/a.png",
    "https://127.0.0.1/a.png",
    "https://ideogram.ai:8443/a.png",
    "https://user:secret@ideogram.ai/a.png",
    "file:///a",
  ])
    assert.equal(isIdeogramImageUrl(address), false);
  assert.equal(
    isIdeogramImageUrl("https://ideogram.ai/assets/example.png"),
    true,
  );
  assert.equal(isIdeogramImageUrl("https://api.ideogram.ai/image.png"), true);
});

test("schema rejects unknown styles, oversized questions and ungrounded coordinates", () => {
  assert.equal(
    requestSchema.safeParse({ mode: "live", question: "a".repeat(1001) })
      .success,
    false,
  );
  assert.equal(
    requestSchema.safeParse({ mode: "demo", style: "invented" }).success,
    false,
  );
  const node = demoNode("engine", "beginner", "scientific");
  node.hotspots[0].x = 1.2;
  assert.equal(requestSchema.safeParse({ mode: "demo", node }).success, false);
});

test("structured lesson rejects invalid relationship references and duplicate components", () => {
  const node = demoNode("engine", "beginner", "scientific");
  assert.equal(
    lessonContentSchema.safeParse({
      ...node,
      relationships: [
        { from: "missing", to: node.components[0].id, description: "bad" },
      ],
    }).success,
    false,
  );
  assert.equal(
    lessonContentSchema.safeParse({
      ...node,
      components: [node.components[0], node.components[0]],
    }).success,
    false,
  );
});

test("demo explore respects the five-level limit and the tutor discloses its demo status", async () => {
  const node = demoNode("engine", "beginner", "scientific");
  const answer = (await processLearning("ask", {
    mode: "demo",
    node,
    question: "How does this work?",
  })) as { demo: boolean; answer: string };
  assert.equal(answer.demo, true);
  assert.ok(answer.answer.length > 20);
  await assert.rejects(
    processLearning("explore", {
      mode: "demo",
      node: { ...node, depth: 5 },
      componentId: node.components[0].id,
    }),
    (error: unknown) =>
      error instanceof LearningError && error.code === "DEPTH_LIMIT",
  );
});

test("engine demo supports deeper learning, contextual tutor, supporting visual, and style without losing the journey", async () => {
  const root = (
    (await processLearning("learn", {
      mode: "demo",
      question: "How does a four-stroke combustion engine work?",
      difficulty: "beginner",
      style: "scientific",
    })) as { node: LearningNode }
  ).node;
  const piston = (
    (await processLearning("explore", {
      mode: "demo",
      node: root,
      componentId: "piston",
    })) as { node: LearningNode }
  ).node;
  assert.equal(piston.parentId, root.id);
  assert.equal(piston.depth, 1);
  assert.match(piston.title.toLowerCase(), /piston/);
  const answer = (await processLearning("ask", {
    mode: "demo",
    node: piston,
    question: "What happens when the piston moves downward?",
  })) as { answer: string; demo: boolean };
  assert.equal(answer.demo, true);
  assert.match(answer.answer.toLowerCase(), /stroke|intake|power/);
  const visual = (
    (await processLearning("visualize", {
      mode: "demo",
      node: piston,
      question: "Show me the four-stroke cycle",
    })) as { node: LearningNode }
  ).node;
  assert.equal(visual.parentId, piston.id);
  assert.equal(visual.depth, 2);
  const styled = (
    (await processLearning("style", {
      mode: "demo",
      node: visual,
      style: "blueprint",
    })) as { node: LearningNode }
  ).node;
  assert.equal(styled.id, visual.id);
  assert.equal(styled.parentId, piston.id);
  assert.equal(styled.explanation, visual.explanation);
  assert.match(styled.imageUrl, /blueprint\.svg$/);
});

test("vision mapping retains only known, unique, confidently grounded component coordinates", async () => {
  const original = globalThis.fetch;
  const node = demoNode("engine", "beginner", "scientific");
  node.imageUrl = `/api/visualize?asset=${"a".repeat(64)}.png`;
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  try {
    globalThis.fetch = async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                hotspots: [
                  {
                    componentId: node.components[0].id,
                    x: 0.37,
                    y: 0.63,
                    confidence: 0.96,
                  },
                  {
                    componentId: node.components[0].id,
                    x: 0.5,
                    y: 0.5,
                    confidence: 0.95,
                  },
                  {
                    componentId: node.components[1].id,
                    x: 0.1,
                    y: 0.2,
                    confidence: 0.5,
                  },
                  {
                    componentId: "not-a-component",
                    x: 0.4,
                    y: 0.2,
                    confidence: 0.99,
                  },
                ],
              }),
            },
          },
        ],
      });
    await runWithRuntimeEnv(
      {
        LLM_API_KEY: "test-only",
        LLM_BASE_URL: "https://tutor.example/v1",
        VISION_MODEL: "vision-test",
        IMAGES: {
          get: async () => ({
            body: new Response(png).body,
            httpMetadata: { contentType: "image/png" },
          }),
        },
      },
      async () => {
        const points = await groundHotspots(node);
        assert.deepEqual(points, [
          {
            componentId: node.components[0].id,
            x: 0.37,
            y: 0.63,
            confidence: 0.96,
          },
        ]);
      },
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("shared generation keeps another subscriber alive when one cancels", async () => {
  const shared = createCoalescer<number>();
  const first = new AbortController();
  let finish!: (value: number) => void;
  let calls = 0;
  let stopped = false;
  const build = (signal: AbortSignal) => {
    calls++;
    signal.addEventListener("abort", () => {
      stopped = true;
    });
    return new Promise<number>((resolve) => {
      finish = resolve;
    });
  };
  const a = shared("same", build, first.signal);
  const b = shared("same", build);
  first.abort();
  await assert.rejects(
    a,
    (error: unknown) =>
      error instanceof LearningError && error.code === "CANCELLED",
  );
  assert.equal(stopped, false);
  finish(42);
  assert.equal(await b, 42);
  assert.equal(calls, 1);
});

test("shared generation stops upstream work when all subscribers leave", async () => {
  const shared = createCoalescer<number>();
  const controller = new AbortController();
  let stopped = false;
  const result = shared(
    "cancel",
    (signal) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => {
          stopped = true;
          reject(new Error("upstream aborted"));
        }),
      ),
    controller.signal,
  );
  controller.abort();
  await assert.rejects(result);
  assert.equal(stopped, true);
});

test("transient explicit rejection retries, ambiguous network failure never repeats a paid request", async () => {
  const original = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return calls === 1
        ? new Response("", { status: 429 })
        : Response.json({ ok: true });
    };
    assert.equal(
      (
        await providerFetch("https://api.ideogram.ai/example", {
          method: "POST",
        })
      ).status,
      200,
    );
    assert.equal(calls, 2);
    calls = 0;
    globalThis.fetch = async () => {
      calls++;
      throw new TypeError("network");
    };
    await assert.rejects(
      providerFetch("https://api.ideogram.ai/example", { method: "POST" }),
    );
    assert.equal(calls, 1);
    calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response("", { status: 504 });
    };
    await assert.rejects(
      providerFetch(
        "https://api.ideogram.ai/example",
        { method: "POST" },
        { retryStatuses: [429] },
      ),
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("persists real image bytes to R2 and never attaches the API key to downloads", async () => {
  const original = globalThis.fetch;
  const images = new Map<string, { bytes: Uint8Array; contentType: string }>();
  const png = new Uint8Array(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(new Headers(options?.headers).has("Api-Key"), false);
      assert.equal(options?.redirect, "manual");
      return new Response(png, { headers: { "Content-Type": "image/png" } });
    };
    await runWithRuntimeEnv(
      {
        IMAGES: {
          put: async (
            key: string,
            bytes: Uint8Array,
            options: { httpMetadata: { contentType: string } },
          ) => {
            images.set(key, {
              bytes,
              contentType: options.httpMetadata.contentType,
            });
          },
          get: async (key: string) => {
            const image = images.get(key);
            return image
              ? {
                  body: new Response(new Blob([image.bytes as BlobPart])).body,
                  httpMetadata: { contentType: image.contentType },
                }
              : null;
          },
        },
      },
      async () => {
        const url = await persistProviderImage(
          "https://ideogram.ai/assets/result.png",
        );
        assert.match(url, /^\/api\/visualize\?asset=[a-f0-9]{64}\.png$/);
        const asset = new URL(url, "https://test.local").searchParams.get(
          "asset",
        )!;
        const stored = await readAsset(asset);
        assert.deepEqual(stored.bytes, png);
        await assert.rejects(readAsset("../secrets"));
      },
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("hosted generation refuses missing permanent storage before paid provider calls", async () => {
  await runWithRuntimeEnv({}, async () => {
    await assert.rejects(
      persistProviderImage("https://ideogram.ai/assets/image.png"),
      (error: unknown) =>
        error instanceof LearningError &&
        error.code === "STORAGE_NOT_CONFIGURED",
    );
  });
});

test("portable manual transport rejects redirects without following them or forwarding credentials", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (_url, options) => {
      calls++;
      assert.equal(options?.redirect, "manual");
      return new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/private" } });
    };
    await assert.rejects(providerFetch("https://api.ideogram.ai/example", { method: "POST", headers: { "Api-Key": "test-only" } }), (error: unknown) => error instanceof LearningError && error.code === "PROVIDER_REDIRECT");
    assert.equal(calls, 1);
    await runWithRuntimeEnv({ IMAGES: {} }, async () => {
      await assert.rejects(persistProviderImage("https://ideogram.ai/assets/redirect.png"), (error: unknown) => error instanceof LearningError && error.code === "PROVIDER_REDIRECT");
    });
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test("live lesson flow validates tutor content, deduplicates requests, saves image, and leaves uncertain hotspots empty", async () => {
  const original = globalThis.fetch;
  let tutorCalls = 0;
  let imageCalls = 0;
  const reviewed = demoNode("engine", "beginner", "scientific");
  const png = new Uint8Array(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  try {
    globalThis.fetch = async (url, options) => {
      if (String(url).includes("/chat/completions")) {
        tutorCalls++;
        return Response.json({
          choices: [{ message: { content: JSON.stringify(reviewed) } }],
        });
      }
      if (String(url).includes("/image/generate/")) {
        imageCalls++;
        assert.equal(new Headers(options?.headers).get("Api-Key"), "test-only");
        return Response.json({
          data: [
            { url: "https://ideogram.ai/assets/test.png", is_image_safe: true },
          ],
        });
      }
      return new Response(png, { headers: { "Content-Type": "image/png" } });
    };
    await runWithRuntimeEnv(
      {
        IDEOGRAM_API_KEY: "test-only",
        LLM_API_KEY: "test-only",
        LLM_BASE_URL: "https://tutor.example/v1",
        VISION_MODEL: "",
        IMAGES: { put: async () => {} },
      },
      async () => {
        const input = {
          mode: "live" as const,
          question: "Unique cache test combustion mechanism",
          difficulty: "beginner" as const,
          style: "scientific" as const,
        };
        const [a, b] = (await Promise.all([
          processLearning("learn", input),
          processLearning("learn", input),
        ])) as { node: LearningNode }[];
        assert.equal(tutorCalls, 1);
        assert.equal(imageCalls, 1);
        assert.notEqual(a.node.id, b.node.id);
        assert.equal(a.node.source, "ideogram");
        assert.equal(a.node.hotspots.length, 0);
        assert.equal(a.node.imageUrl, b.node.imageUrl);
        await processLearning("learn", input);
        assert.equal(imageCalls, 1);
      },
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("HTTP validation blocks cross-origin and oversized requests without exposing internal errors", async () => {
  const request = (body: string, origin = "https://learn.example") =>
    new Request("https://learn.example/api/learn", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body,
    });
  assert.equal(
    (
      await handleLearningRequest(
        request("{}", "https://other.example"),
        "learn",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleLearningRequest(
        request(JSON.stringify({ question: "a".repeat(200_000) })),
        "learn",
      )
    ).status,
    413,
  );
  assert.equal(
    (await handleLearningRequest(request("{"), "learn")).status,
    400,
  );
  assert.equal(
    (
      await handleLearningRequest(
        request(JSON.stringify({ mode: "demo", question: "engine" })),
        "learn",
      )
    ).status,
    200,
  );
});

test("session request budget is bounded within an hour and resets afterward", () => {
  const id = crypto.randomUUID();
  for (let count = 0; count < 20; count++) consumeBudget(id, 1_000_000);
  assert.throws(
    () => consumeBudget(id, 1_000_001),
    (error: unknown) =>
      error instanceof LearningError && error.code === "SESSION_LIMIT",
  );
  assert.doesNotThrow(() => consumeBudget(id, 4_600_001));
});

test("image-only studio persists an Ideogram image without an LLM and reuses its cache", async () => {
  const original = globalThis.fetch;
  const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  let generationCalls = 0;
  const saved = new Map<string, Uint8Array>();
  try {
    globalThis.fetch = async (url, options) => {
      if (String(url) === "https://api.ideogram.ai/v2/image/generate/ideogram-4-5") {
        generationCalls++;
        const payload = JSON.parse(String(options?.body)) as { prompt: string };
        assert.doesNotMatch(payload.prompt, /following 0/);
        assert.match(payload.prompt, /No tutor or independently verified explanation/);
        return Response.json({ data: [{ url: "https://ideogram.ai/assets/studio-test.png", is_image_safe: true }] });
      }
      assert.equal(String(url), "https://ideogram.ai/assets/studio-test.png", "Image-only requests must never call a tutor provider");
      assert.equal(new Headers(options?.headers).has("Api-Key"), false);
      return new Response(png, { headers: { "Content-Type": "image/png" } });
    };
    await runWithRuntimeEnv({
      IDEOGRAM_API_KEY: "test-only", LLM_API_KEY: "", OPENAI_API_KEY: "", LLM_BASE_URL: "", VISION_MODEL: "",
      BILLING_TEST_MODE: "true", LIVE_GENERATION_OWNER_ID: "studio-test-owner",
      STRIPE_SECRET_KEY: "", IMAGES: { put: async (key: string, bytes: Uint8Array) => { saved.set(key, bytes); } },
    }, async () => {
      const request = () => new Request("https://learn.example/api/illustrate", {
        method: "POST", headers: { "Content-Type": "application/json", Origin: "https://learn.example", "oai-authenticated-user-id": "studio-test-owner" },
        body: JSON.stringify({ question: "Image-only test of a camera obscura", style: "blueprint", sessionId: "studio-test-session" }),
      });
      const first = await handleIllustrationRequest(request());
      assert.equal(first.status, 200);
      const result = await first.json() as { id: string; imageUrl: string; source: string; note: string };
      assert.equal(result.source, "ideogram");
      assert.equal(result.note, "Image only; no AI tutoring or verified explanation.");
      const asset = new URL(result.imageUrl, "https://learn.example").searchParams.get("asset")!;
      assert.deepEqual(saved.get(`generated/${asset}`), png);
      const second = await handleIllustrationRequest(request());
      assert.equal(second.status, 200);
      assert.equal((await second.json() as { imageUrl: string }).imageUrl, result.imageUrl);
      assert.equal(generationCalls, 1);
    });
  } finally { globalThis.fetch = original; }
});
