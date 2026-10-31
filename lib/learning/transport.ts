import { abortIfNeeded, LearningError } from "./errors";

const TRANSIENT = new Set([429, 502, 503, 504]);
export async function providerFetch(
  url: string,
  options: RequestInit,
  config: {
    signal?: AbortSignal;
    timeout?: number;
    retry?: boolean;
    retryStatuses?: readonly number[];
  } = {},
): Promise<Response> {
  const attempts = config.retry === false ? 1 : 2;
  for (let attempt = 0; attempt < attempts; attempt++) {
    abortIfNeeded(config.signal);
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    config.signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(
      () => controller.abort(),
      config.timeout ?? 45_000,
    );
    try {
      const response = await fetch(url, {
        ...options,
        // Workers support manual/follow; explicit rejection also prevents forwarding credentials.
        redirect: "manual",
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        throw new LearningError(
          "PROVIDER_REDIRECT",
          "The AI service returned an unsupported redirect. Please try again later.",
          502,
        );
      }
      if (response.ok) return response;
      if (
        attempt + 1 < attempts &&
        (config.retryStatuses
          ? config.retryStatuses.includes(response.status)
          : TRANSIENT.has(response.status))
      ) {
        await response.body?.cancel();
        const retryAfter = Number(response.headers.get("retry-after"));
        await pause(
          Math.min(
            Number.isFinite(retryAfter) && retryAfter > 0
              ? retryAfter * 1000
              : 800 * 2 ** attempt,
            2500,
          ),
          config.signal,
        );
        continue;
      }
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403)
        throw new LearningError(
          "PROVIDER_AUTH",
          "The connected AI service could not authenticate. Check the server configuration.",
          503,
        );
      if (response.status === 429)
        throw new LearningError(
          "PROVIDER_BUSY",
          "The image or tutor service is busy. Please try again shortly.",
          429,
        );
      throw new LearningError(
        "PROVIDER_ERROR",
        `The AI service could not complete this request (${response.status}).`,
        502,
      );
    } catch (error) {
      if (error instanceof LearningError) throw error;
      abortIfNeeded(config.signal);
      // Never repeat a paid request when its completion is unknown.
      if (controller.signal.aborted)
        throw new LearningError(
          "PROVIDER_TIMEOUT",
          "The AI service took too long. This request was stopped; please try again.",
          504,
        );
      throw new LearningError(
        "PROVIDER_CONNECTION",
        "The AI service could not be reached. Please try again.",
        502,
      );
    } finally {
      clearTimeout(timer);
      config.signal?.removeEventListener("abort", onAbort);
    }
  }
  throw new LearningError(
    "PROVIDER_ERROR",
    "The AI service could not complete this request.",
    502,
  );
}

async function pause(ms: number, signal?: AbortSignal) {
  abortIfNeeded(signal);
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", stop);
      resolve();
    }, ms);
    const stop = () => {
      clearTimeout(timer);
      reject(
        new LearningError("CANCELLED", "This request was cancelled.", 499),
      );
    };
    signal?.addEventListener("abort", stop, { once: true });
  });
}

export async function limitedBytes(
  response: Response,
  max: number,
  options: { signal?: AbortSignal; timeout?: number } = {},
): Promise<Uint8Array> {
  abortIfNeeded(options.signal);
  const declared = Number(response.headers.get("content-length"));
  if (declared > max) {
    await response.body?.cancel();
    throw new LearningError(
      "IMAGE_TOO_LARGE",
      "The generated image was too large to save.",
      502,
    );
  }
  if (!response.body)
    throw new LearningError(
      "EMPTY_IMAGE",
      "The image service returned an empty image.",
      502,
    );
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timedOut = false;
  const stop = () => {
    void reader.cancel().catch(() => {});
  };
  const timer = setTimeout(() => {
    timedOut = true;
    stop();
  }, options.timeout ?? 30_000);
  options.signal?.addEventListener("abort", stop, { once: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new LearningError(
          "IMAGE_TOO_LARGE",
          "The generated image was too large to save.",
          502,
        );
      }
      chunks.push(value);
    }
    abortIfNeeded(options.signal);
    if (timedOut)
      throw new LearningError(
        "PROVIDER_TIMEOUT",
        "The AI service took too long to deliver its result.",
        504,
      );
  } catch (error) {
    abortIfNeeded(options.signal);
    if (timedOut)
      throw new LearningError(
        "PROVIDER_TIMEOUT",
        "The AI service took too long to deliver its result.",
        504,
      );
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", stop);
    reader.releaseLock();
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
