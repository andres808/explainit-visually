import { getRuntimeEnv } from "../runtime-env";
import { LearningError } from "./errors";
import { limitedBytes, providerFetch } from "./transport";

type Bucket = {
  put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: { contentType: string } },
  ): Promise<unknown>;
  get(
    key: string,
  ): Promise<{
    body: ReadableStream;
    httpMetadata?: { contentType?: string };
    arrayBuffer(): Promise<ArrayBuffer>;
  } | null>;
};
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const ASSET = /^[a-f0-9]{64}\.(png|jpg|webp)$/;
const MAX_IMAGE = 12 * 1024 * 1024;

export function isIdeogramImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (url.hostname === "ideogram.ai" || url.hostname.endsWith(".ideogram.ai"))
    );
  } catch {
    return false;
  }
}

export function assertStorage() {
  const runtime = getRuntimeEnv();
  if (runtime.__WORKER_RUNTIME && !runtime.IMAGES)
    throw new LearningError(
      "STORAGE_NOT_CONFIGURED",
      "Live illustrations need permanent image storage. The sample lessons are ready to explore.",
      503,
    );
}

export async function persistProviderImage(
  url: string,
  signal?: AbortSignal,
): Promise<string> {
  assertStorage();
  if (!isIdeogramImageUrl(url))
    throw new LearningError(
      "IMAGE_HOST_REJECTED",
      "The image service returned an unsupported download address.",
      502,
    );
  // The API key belongs only on Ideogram POST requests, never image downloads.
  const response = await providerFetch(
    url,
    { method: "GET", headers: { Accept: "image/png,image/jpeg,image/webp" } },
    { signal, timeout: 30_000 },
  );
  const mime = (response.headers.get("content-type") || "")
    .split(";")[0]
    .toLowerCase();
  const extension = MIME_EXT[mime];
  if (!extension) {
    await response.body?.cancel();
    throw new LearningError(
      "IMAGE_TYPE_REJECTED",
      "The image service returned an unsupported image type.",
      502,
    );
  }
  const bytes = await limitedBytes(response, MAX_IMAGE, { signal });
  if (!validSignature(bytes, mime))
    throw new LearningError(
      "INVALID_IMAGE",
      "The image service did not return a valid image.",
      502,
    );
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  const hash = Array.from(new Uint8Array(digest), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
  const asset = `${hash}.${extension}`;
  const runtime = getRuntimeEnv();
  try {
    if (runtime.IMAGES) {
      await (runtime.IMAGES as Bucket).put(`generated/${asset}`, bytes, {
        httpMetadata: { contentType: mime },
      });
      return `/api/visualize?asset=${asset}`;
    }
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const directory = path.join(process.cwd(), "public", "generated");
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, asset), bytes);
    return `/generated/${asset}`;
  } catch {
    throw new LearningError(
      "STORAGE_FAILED",
      "The illustration was created, but could not be saved permanently. Check image storage before generating again.",
      503,
    );
  }
}

function validSignature(bytes: Uint8Array, mime: string) {
  if (mime === "image/png")
    return (
      bytes.length > 8 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
    );
  if (mime === "image/jpeg")
    return (
      bytes.length > 3 &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255
    );
  return (
    bytes.length > 12 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  );
}

export async function readAsset(
  asset: string,
): Promise<{ bytes: Uint8Array; mime: string }> {
  if (!ASSET.test(asset))
    throw new LearningError(
      "ASSET_NOT_FOUND",
      "This saved illustration could not be found.",
      404,
    );
  const runtime = getRuntimeEnv();
  if (runtime.IMAGES) {
    const object = await (runtime.IMAGES as Bucket).get(`generated/${asset}`);
    if (!object)
      throw new LearningError(
        "ASSET_NOT_FOUND",
        "This saved illustration could not be found.",
        404,
      );
    const response = new Response(object.body);
    const bytes = await limitedBytes(response, MAX_IMAGE);
    return {
      bytes,
      mime: object.httpMetadata?.contentType || mimeForAsset(asset),
    };
  }
  assertStorage();
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const bytes = await fs.readFile(
      path.join(process.cwd(), "public", "generated", asset),
    );
    if (bytes.byteLength > MAX_IMAGE) throw new Error("Image too large");
    return { bytes: new Uint8Array(bytes), mime: mimeForAsset(asset) };
  } catch {
    throw new LearningError(
      "ASSET_NOT_FOUND",
      "This saved illustration could not be found.",
      404,
    );
  }
}

function mimeForAsset(asset: string) {
  return asset.endsWith(".jpg")
    ? "image/jpeg"
    : asset.endsWith(".webp")
      ? "image/webp"
      : "image/png";
}

export async function readNodeImage(imageUrl: string) {
  const match =
    /^\/generated\/([a-f0-9]{64}\.(?:png|jpg|webp))$/.exec(imageUrl) ||
    /^\/api\/visualize\?asset=([a-f0-9]{64}\.(?:png|jpg|webp))$/.exec(imageUrl);
  if (!match)
    throw new LearningError(
      "EDIT_UNAVAILABLE",
      "Generate a live illustration before refining its appearance.",
      422,
    );
  return readAsset(match[1]);
}
