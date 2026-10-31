import type { LearningNode, VisualStyle } from "../types";
import { setting } from "./config";
import { abortIfNeeded, LearningError } from "./errors";
import { assertStorage, persistProviderImage, readNodeImage } from "./storage";
import { limitedBytes, providerFetch } from "./transport";
import { createCoalescer } from "./coalesce";

const imageCache = new Map<string, { imageUrl: string; expires: number }>();
const sharedImage = createCoalescer<string>();

const STYLES: Record<VisualStyle, string> = {
  scientific:
    "Precise editorial scientific cutaway illustration, muted mineral colors, realistic spatial relationships, warm ivory background.",
  isometric:
    "Polished isometric educational illustration, clearly separated three-dimensional components, soft studio lighting, warm ivory background.",
  blueprint:
    "Legible technical blueprint, crisp white and pale cyan engineering linework on a deep navy background, coherent mechanical relationships.",
  textbook:
    "Beautiful modern textbook illustration, clear colored shapes, restrained cross-sections, legible silhouette on warm ivory.",
  sketch:
    "Careful hand-drawn scientific field sketch with graphite linework and restrained watercolor accents on warm paper.",
  futuristic:
    "Sophisticated futuristic educational cutaway, luminous cyan and amber accents, dark neutral background, mechanically coherent forms.",
};

export function illustrationPrompt(
  node: Pick<
    LearningNode,
    "title" | "summary" | "components" | "difficulty" | "style"
  >,
  focus?: string,
) {
  return [
    `Create one educational illustration of ${node.title}. ${node.summary}`,
    STYLES[node.style],
    node.components.length
      ? `Teaching level: ${node.difficulty}. Show the following ${node.components.length} visually distinct parts with scientifically plausible arrangement:`
      : "Interpret the requested subject directly as an image prompt. Create a clear illustration showing relevant visible relationships where appropriate. No tutor or independently verified explanation accompanies this image; do not imply verification or invent a mechanism.",
    ...node.components.map(
      (c, i) =>
        `${i + 1}. ${c.name}: ${c.visualDescription.slice(0, 450)}. Its role: ${c.function.slice(0, 200)}`,
    ),
    focus ? `Focus the composition on this question: ${focus}` : "",
    "Use an accurate cutaway or exploded view only when meaningful to the subject. For abstract subjects, use a clear conceptual diagram rather than a fake physical machine.",
    "Generous negative space, strong hierarchy, uncluttered composition. No decorative parts, no invented mechanisms, no arrows implying unsupported causal relationships. No text, labels, letters, numbers, legend, or watermark.",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 9000);
}

export async function generateIllustration(
  node: LearningNode,
  signal?: AbortSignal,
  focus?: string,
): Promise<string> {
  abortIfNeeded(signal);
  assertStorage();
  const key = setting("IDEOGRAM_API_KEY");
  if (!key)
    throw new LearningError(
      "IDEOGRAM_NOT_CONFIGURED",
      "Connect Ideogram to generate new illustrations. The sample lessons are ready to explore.",
      503,
    );
  const prompt = illustrationPrompt(node, focus);
  const keyForImage = JSON.stringify([
    "ideogram-4-5",
    prompt,
    node.difficulty,
    node.style,
    "1024x1024",
    "medium",
  ]);
  const saved = imageCache.get(keyForImage);
  if (saved && saved.expires > Date.now()) return saved.imageUrl;
  return sharedImage(
    keyForImage,
    async (internalSignal) => {
      const response = await providerFetch(
        "https://api.ideogram.ai/v2/image/generate/ideogram-4-5",
        {
          method: "POST",
          headers: {
            "Api-Key": key,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            prompt,
            size: "1024x1024",
            quality: "medium",
            num_images: 1,
            magic_prompt: "off",
          }),
        },
        { signal: internalSignal, timeout: 100_000, retryStatuses: [429] },
      );
      const imageUrl = await extractAndSave(response, internalSignal);
      if (imageCache.size >= 48)
        imageCache.delete(imageCache.keys().next().value!);
      imageCache.set(keyForImage, {
        imageUrl,
        expires: Date.now() + 3_600_000,
      });
      return imageUrl;
    },
    signal,
  );
}

export async function editIllustration(
  node: LearningNode,
  componentId?: string,
  signal?: AbortSignal,
) {
  abortIfNeeded(signal);
  assertStorage();
  const key = setting("IDEOGRAM_API_KEY");
  if (!key)
    throw new LearningError(
      "IDEOGRAM_NOT_CONFIGURED",
      "Connect Ideogram to refine this illustration.",
      503,
    );
  const original = await readNodeImage(node.imageUrl);
  const component = node.components.find((c) => c.id === componentId);
  const form = new FormData();
  form.set(
    "image",
    new Blob([original.bytes as BlobPart], { type: original.mime }),
    `lesson.${original.mime === "image/jpeg" ? "jpg" : original.mime === "image/webp" ? "webp" : "png"}`,
  );
  form.set(
    "prompt",
    `Retain the original composition, all educational content, component locations, and scientific relationships. ${STYLES[node.style]} ${component ? `Gently emphasize the ${component.name} (${component.visualDescription}) with a restrained amber highlight. Preserve every other part.` : "Refine the illustration into the specified visual style while preserving every part."} Do not add text, arrows, labels, or new components.`,
  );
  const response = await providerFetch(
    "https://api.ideogram.ai/v2/image/precise-edit/ideogram-4-5",
    {
      method: "POST",
      headers: { "Api-Key": key, Accept: "application/json" },
      body: form,
    },
    { signal, timeout: 100_000, retryStatuses: [429] },
  );
  return extractAndSave(response, signal);
}

async function extractAndSave(response: Response, signal?: AbortSignal) {
  let data: unknown;
  try {
    data = JSON.parse(
      new TextDecoder().decode(
        await limitedBytes(response, 128 * 1024, { signal }),
      ),
    );
  } catch (error) {
    if (error instanceof LearningError) throw error;
    throw new LearningError(
      "INVALID_PROVIDER_RESPONSE",
      "The image service returned an unreadable result.",
      502,
    );
  }
  const item = (data as { data?: { url?: unknown; is_image_safe?: boolean }[] })
    ?.data?.[0];
  if (item?.is_image_safe === false)
    throw new LearningError(
      "IMAGE_NOT_AVAILABLE",
      "The image service could not create an illustration for this topic. Try rephrasing the question.",
      422,
    );
  if (typeof item?.url !== "string")
    throw new LearningError(
      "INVALID_PROVIDER_RESPONSE",
      "The image service did not return an illustration.",
      502,
    );
  return persistProviderImage(item.url, signal);
}
