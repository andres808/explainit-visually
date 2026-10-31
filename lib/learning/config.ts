import { getRuntimeEnv } from "../runtime-env";
import { LearningError } from "./errors";

export function setting(name: string): string {
  const value = getRuntimeEnv()[name] ?? process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

export function llmConfig() {
  const key = setting("LLM_API_KEY") || setting("OPENAI_API_KEY");
  const base =
    setting("LLM_BASE_URL") ||
    (setting("OPENAI_API_KEY") ? "https://api.openai.com/v1" : "");
  if (!key || !base)
    throw new LearningError(
      "LLM_NOT_CONFIGURED",
      "Live lessons need a configured AI tutor. You can explore the sample lessons now.",
      503,
    );
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new LearningError(
      "LLM_CONFIG_INVALID",
      "The AI tutor endpoint is not configured correctly.",
      503,
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new LearningError(
      "LLM_CONFIG_INVALID",
      "The AI tutor endpoint must be a secure HTTPS URL.",
      503,
    );
  return {
    key,
    base: url.toString().replace(/\/$/, ""),
    model: setting("LLM_MODEL") || "gpt-4.1-mini",
    visionModel: setting("VISION_MODEL"),
  };
}

export function health() {
  let tutor = false;
  try {
    llmConfig();
    tutor = true;
  } catch {
    /* Configuration only; never call providers. */
  }
  const runtime = getRuntimeEnv();
  return {
    demo: true,
    ideogram: Boolean(setting("IDEOGRAM_API_KEY")),
    tutor,
    vision: tutor && Boolean(setting("VISION_MODEL")),
    storage: Boolean(runtime.IMAGES) || !runtime.__WORKER_RUNTIME,
    live:
      tutor &&
      Boolean(setting("IDEOGRAM_API_KEY")) &&
      (Boolean(runtime.IMAGES) || !runtime.__WORKER_RUNTIME),
  };
}
