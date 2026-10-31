# ExplainIt Visually

An interactive visual-learning app: ask a question, explore a diagram, select a component, and follow it into a deeper explanation. Built with Next.js App Router, TypeScript, React, Tailwind, shadcn/ui, Lucide, Motion, and Zod. The hosted build uses the Next-compatible Vinext runtime for Cloudflare Workers; ordinary Next.js development is also supported.

**Try the public test site:** [ExplainIt Visually](https://explainit-visually-lab.super-grebe-4992.chatgpt.site/).

## Current hosted status

The site is publicly accessible for testing. The curated learning demo and Stripe sandbox checkout are available to visitors. Live AI generation is restricted to the trusted, signed-in site owner during billing tests through `LIVE_GENERATION_OWNER_ID`; a public test subscription does not authorize spending the owner's AI-provider credits.

The hosted app is configured to use **Gemini through an OpenAI-compatible API** for educational text and **Ideogram 4.5** for images. Stripe is configured with a **CA$1 CAD monthly sandbox subscription**. Test checkout, signed webhook delivery, and customer portal access have been verified, and a synthetic test subscription's renewal was canceled. **Real billing is not enabled.**

These describe the test deployment. A fresh clone contains application code and example configuration, not the hosted credentials or account configuration.

## Run locally

Requires Node.js 22.13 or newer. From the repository root:

```sh
npm ci
```

Copy `.env.example` to `.env.local`, then start the app:

```sh
npm run dev
```

Open [localhost:5173](http://localhost:5173). Alternatively, `npm run dev:next` runs ordinary Next.js at [localhost:3000](http://localhost:3000). Demo mode works without API credentials.

Run the project checks with:

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

`npm run build:next` builds with ordinary Next.js. Environment files containing credentials, generated output, and private billing data belong outside source control. The example environment file contains configuration names and defaults only.

## Demo walkthrough

Choose the engine card, click **Piston**, then **Explore deeper**. Ask “What happens when the piston moves downward?” and choose **Show me visually**. Return to an earlier node through the journey tree, then change the style to **Engineering Blueprint**.

The demo includes six curated topics and engine drilldowns. The scientific engine example uses a real, pre-generated Ideogram 4.5 illustration with manually inspected component positions. Its scientific depiction has not been independently verified; ambiguous valve positions are omitted from the image labels. Other diagrams and engine style variants use original vector schematics in six palettes. All demo learning text is predefined, and opening a seeded example does not generate a new image.

Zoom, pan, annotation toggling, fullscreen, comparison with a parent diagram, manual component mapping, a local library, journey download, and mobile explanation/journey panels are supported. Unsupported demo questions explain the limitation. Changing between the generated engine image and its vector variants restores the appropriate component map; vector palettes share geometry. Browser storage preserves journeys between visits. Clearing site data clears the local journey.

## Ideogram image studio

Open `/studio` or follow the homepage studio link to create an illustration directly with Ideogram. This workflow does not require an LLM. It is labeled **illustration only**, with no AI tutor or verified educational explanation; generated images can contain inaccurate details.

Each explicit **Generate** action can use provider credits. The studio includes cancellation, manual retry, image downloads, and browser history for the latest 12 illustrations. Generated images use the configured server storage. The studio shares live-generation authorization, billing, rate limits, concurrency limits, image caching, and storage controls with the learning service. In the current hosted sandbox, new generation is reserved for the site owner.

## AI configuration and generation

Set `IDEOGRAM_API_KEY`, `LLM_API_KEY`, `LLM_BASE_URL`, and `LLM_MODEL` on the server. The educational layer accepts an OpenAI-compatible chat/completions provider; the current hosted deployment uses Gemini. `OPENAI_API_KEY` is an alternative key alias, with `https://api.openai.com/v1` as its default endpoint when no base URL is set.

Choose a model that supports JSON response mode. `VISION_MODEL` is optional and must accept image inputs through the same provider. Without a vision model, newly generated images have no invented hotspots: use **Map components** to place labels manually. A configured vision model returns only confidently located components. Review generated educational output before relying on it.

Ideogram uses the official API v2 Ideogram 4.5 generation endpoint and multipart precise-edit endpoint. `Api-Key` authentication stays on the server. Each generation action requests at most one medium-quality 1024 × 1024 illustration; **Emphasize** invokes precise edit. Prompts request no image text, and the app renders its own labels. A separate educational model supplies explanations and component relationships. The app does not claim independent scientific verification.

Requests have bounded timeouts, concurrency and input limits, deduplication, normalized lesson caching, image prompt caching, hourly per-address/session limits, and a maximum exploration depth of five. Transient provider rejections receive bounded backoff; ambiguous paid network failures are not automatically retried. Canceling the client cancels shared work when all consumers cancel, although a provider may already be processing an image and may still charge for it. Input changes and initial rendering do not trigger paid generation.

Generated provider URLs are downloaded immediately with bounded bytes/time, strict HTTPS Ideogram host checks, redirect refusal, raster signature checks, and no credential on the download request. Ordinary Next.js development stores image bytes in `public/generated`. Worker development and hosting use the `IMAGES` R2 binding, served through `GET /api/visualize?asset=…`. The `.openai/hosting.json` manifest declares the binding.

## API

| Method | Route | Request |
| --- | --- | --- |
| POST | `/api/learn` | `{mode, question, difficulty, style}` |
| POST | `/api/explore` | `{mode, node, componentId}` |
| POST | `/api/ask` | `{mode, node, componentId?, question, simple?}` |
| POST | `/api/visualize` | `{mode, node, question?}` |
| POST | `/api/style` | `{mode, node, style, edit?, componentId?}` |
| POST | `/api/hotspots` | `{mode, node}` |
| POST | `/api/illustrate` | `{question, style, difficulty?, sessionId?}` |
| GET | `/api/health` | Configuration booleans; no secrets |

Learning requests use `mode: "demo"` or `mode: "live"`. Node-returning requests respond with `{node}`; the tutor returns `{answer, suggestions, demo}`, and component mapping returns `{hotspots}`. The illustration-only endpoint returns `{id, imageUrl, question, style, createdAt, source, note}`. Live requests are subject to server-side authorization and billing controls.

The browser holds the learning tree and sends validated nodes as request context. Browser-supplied text is not treated as verified educational evidence. Generated image reads accept only app-owned asset identifiers.

## Monthly subscriptions

See [README-billing.md](README-billing.md) for setup and verification instructions. Configure a fixed recurring monthly `STRIPE_PRICE_ID`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BILLING_SESSION_SECRET` with at least 32 random characters, `APP_URL`, and durable `DB` storage.

The current public test deployment offers a CA$1 CAD monthly **sandbox** checkout. Signed webhook delivery updates server-side subscription entitlement, and the customer portal manages the browser-associated customer. Checkout success query parameters do not grant access. A synthetic test subscription's renewal was canceled during verification; no real customer billing is enabled.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/billing/checkout` | Create a Stripe-hosted monthly subscription checkout |
| POST | `/api/billing/portal` | Open the current browser's customer portal |
| GET | `/api/billing/status` | Read configuration and subscription entitlement |
| POST | `/api/billing/webhook` | Verify the signed raw webhook body and update entitlement |

During sandbox billing, live generation requires the site's trusted authenticated owner identity to match `LIVE_GENERATION_OWNER_ID`. Outside test mode, live generation requires configured billing and an active subscription. Demo exploration remains available. Subscription association is browser-bound in this MVP; cross-device recovery needs an identity flow.

## Deployment

The Sites manifest declares `IMAGES` (R2) and `DB` (D1). The worker passes request-scoped environment secrets and bindings to server services. Store deployment credentials through Sites environment settings; keep secrets out of `.openai/hosting.json` and source control.

The current site has a public testing audience. Its restricted live-generation policy is separate from that public audience setting. A new deployment needs its own provider credentials, storage bindings, Stripe sandbox or production configuration, webhook endpoint, and applicable owner-generation policy.

## Optional OpenRouter stack recipe

A separate Stripe Projects setup contains an OpenRouter API resource on a free plan. Its reusable stack recipe is [OpenRouter API on Stripe Projects](https://projects.dev/s#v1:OpenRouter~api).

That resource is **not wired into the hosted ExplainIt Visually app**; the hosted educational provider is Gemini. The recipe describes a separate provisioning option and does not include application credentials or change the app's provider configuration. Anyone adopting it must provision their own resource and explicitly configure an appropriate OpenAI-compatible endpoint, model, and server-side key.

## Provider references

- [Ideogram 4.5 generation](https://developer.ideogram.ai/api-reference/images/generate/ideogram-4-5)
- [Ideogram 4.5 precise edit](https://developer.ideogram.ai/api-reference/images/precise-edit/ideogram-4-5)
- [Stripe billing setup and verification](README-billing.md)
