import type { LearningNode } from "../types";
import { demoAnswer, demoNode, demoRestyle } from "../demo";
import { abortIfNeeded, LearningError } from "./errors";
import { editIllustration, generateIllustration } from "./ideogram";
import { answerQuestion, createLesson, groundHotspots } from "./llm";
import type { LearningRequest } from "./schema";
import { health, llmConfig, setting } from "./config";
import { assertStorage } from "./storage";
import { createCoalescer } from "./coalesce";

export type LearningAction =
  | "learn"
  | "explore"
  | "ask"
  | "visualize"
  | "style"
  | "hotspots";
type CacheEntry = { value: LearningNode; expires: number };
const cache = new Map<string, CacheEntry>();
const shared = createCoalescer<LearningNode>();
const CACHE_TTL = 60 * 60 * 1000;
const CACHE_MAX = 48;
let active = 0;
const budgets = new Map<string, { start: number; count: number }>();

export function normalizedTopic(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
export function cacheKey(
  question: string,
  difficulty: string,
  style: string,
  context = "",
) {
  return JSON.stringify([
    normalizedTopic(question),
    difficulty,
    style,
    context,
  ]);
}

export function consumeBudget(identity: string, now = Date.now()) {
  if (budgets.size > 5000)
    for (const [key, budget] of budgets)
      if (now - budget.start > 3_600_000) budgets.delete(key);
  const value = budgets.get(identity);
  if (!value || now - value.start >= 3_600_000) {
    if (budgets.size >= 5000) budgets.delete(budgets.keys().next().value!);
    budgets.set(identity, { start: now, count: 1 });
    return;
  }
  const configured = Number(setting("MAX_SESSION_REQUESTS"));
  const limit =
    Number.isInteger(configured) && configured > 0
      ? Math.min(configured, 100)
      : 20;
  if (value.count >= limit)
    throw new LearningError(
      "SESSION_LIMIT",
      "You have reached this session’s hourly AI limit. Your saved lessons are still available.",
      429,
    );
  value.count++;
}

export async function processLearning(
  action: LearningAction,
  input: LearningRequest,
  signal?: AbortSignal,
): Promise<unknown> {
  abortIfNeeded(signal);
  if (action === "learn") {
    if (!input.question)
      throw new LearningError(
        "QUESTION_REQUIRED",
        "Ask a question to start your visual lesson.",
        400,
      );
    if (input.mode === "demo")
      return {
        node: await demoNode(
          input.question,
          input.difficulty || "beginner",
          input.style || "scientific",
        ),
      };
    return {
      node: await newLesson(
        input.question,
        input.difficulty || "beginner",
        input.style || "scientific",
        undefined,
        signal,
      ),
    };
  }
  const node = input.node;
  if (!node)
    throw new LearningError(
      "LESSON_REQUIRED",
      "Open a lesson before exploring this action.",
      400,
    );
  const component = input.componentId
    ? node.components.find((c) => c.id === input.componentId)
    : undefined;
  if (input.componentId && !component)
    throw new LearningError(
      "COMPONENT_NOT_FOUND",
      "That component is not part of this lesson.",
      400,
    );
  if (action === "ask") {
    if (!input.question)
      throw new LearningError(
        "QUESTION_REQUIRED",
        "Type a question for your tutor.",
        400,
      );
    if (input.mode === "demo")
      return await demoAnswer(
        node,
        input.question,
        input.componentId,
        input.simple,
      );
    return inSlot(() =>
      answerQuestion(
        node,
        input.question!,
        input.componentId,
        input.simple,
        signal,
      ),
    );
  }
  if (action === "hotspots") {
    if (input.mode === "demo") return { hotspots: node.hotspots };
    return { hotspots: await inSlot(() => groundHotspots(node, signal)) };
  }
  if (action === "explore") {
    if (!component)
      throw new LearningError(
        "COMPONENT_REQUIRED",
        "Choose a component to explore in more detail.",
        400,
      );
    assertDepth(node);
    if (input.mode === "demo")
      return {
        node: await demoNode(
          component.deeperQuestion,
          node.difficulty,
          node.style,
          node,
          component,
        ),
      };
    return {
      node: await newLesson(
        component.deeperQuestion,
        node.difficulty,
        node.style,
        node,
        signal,
      ),
    };
  }
  if (action === "style") {
    if (!input.style)
      throw new LearningError("STYLE_REQUIRED", "Choose a visual style.", 400);
    if (input.mode === "demo") {
      return { node: demoRestyle(node, input.style) };
    }
    ensureLive();
    const styled: LearningNode = {
      ...node,
      style: input.style,
      source: "ideogram",
      hotspots: [],
    };
    return {
      node: await inSlot(async () => {
        styled.imageUrl = input.edit
          ? await editIllustration(styled, input.componentId, signal)
          : await generateIllustration(styled, signal);
        styled.hotspots = await groundHotspots(styled, signal);
        return styled;
      }),
    };
  }
  if (input.question) {
    assertDepth(node);
    if (input.mode === "demo")
      return {
        node: await demoNode(input.question, node.difficulty, node.style, node),
      };
    return {
      node: await newLesson(
        input.question,
        node.difficulty,
        node.style,
        node,
        signal,
      ),
    };
  }
  if (input.mode === "demo") return { node };
  ensureLive();
  return {
    node: await inSlot(async () => {
      const refreshed = {
        ...node,
        source: "ideogram" as const,
        imageUrl: await generateIllustration(node, signal),
        hotspots: [] as LearningNode["hotspots"],
      };
      refreshed.hotspots = await groundHotspots(refreshed, signal);
      return refreshed;
    }),
  };
}

function assertDepth(node: LearningNode) {
  if (node.depth >= 5)
    throw new LearningError(
      "DEPTH_LIMIT",
      "You have reached five levels in this journey. Start a new lesson to keep exploring.",
      422,
    );
}
function ensureLive() {
  llmConfig();
  assertStorage();
  if (!health().ideogram)
    throw new LearningError(
      "IDEOGRAM_NOT_CONFIGURED",
      "Connect Ideogram to generate new illustrations. Sample lessons are ready to explore.",
      503,
    );
}

async function newLesson(
  question: string,
  difficulty: LearningNode["difficulty"],
  style: LearningNode["style"],
  parent?: LearningNode,
  signal?: AbortSignal,
) {
  ensureLive();
  const model = llmConfig();
  const key = cacheKey(
    question,
    difficulty,
    style,
    JSON.stringify({
      promptVersion: "museum-lesson-1",
      model: model.model,
      provider: model.base,
      parent: parent
        ? {
            title: parent.title,
            summary: parent.summary,
            explanation: parent.explanation,
          }
        : null,
    }),
  );
  const existing = cache.get(key);
  let lesson: LearningNode;
  if (existing && existing.expires > Date.now()) lesson = existing.value;
  else {
    if (existing) cache.delete(key);
    lesson = await shared(
      key,
      async (internalSignal) =>
        inSlot(async () => {
          const content = await createLesson(
            question,
            difficulty,
            parent,
            internalSignal,
          );
          const draft: LearningNode = {
            ...content,
            caveats: [
              ...content.caveats.slice(0, 5),
              "AI-generated educational illustration: a simplified model whose visual details may be imperfect.",
            ],
            id: crypto.randomUUID(),
            parentId: parent?.id || null,
            depth: parent ? parent.depth + 1 : 0,
            question,
            difficulty,
            style,
            source: "ideogram",
            imageUrl: "",
            hotspots: [],
            createdAt: new Date().toISOString(),
          };
          draft.imageUrl = await generateIllustration(draft, internalSignal);
          draft.hotspots = await groundHotspots(draft, internalSignal);
          if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
          cache.set(key, { value: draft, expires: Date.now() + CACHE_TTL });
          return draft;
        }),
      signal,
    );
  }
  abortIfNeeded(signal);
  return {
    ...structuredClone(lesson),
    id: crypto.randomUUID(),
    parentId: parent?.id || null,
    depth: parent ? parent.depth + 1 : 0,
    question,
    createdAt: new Date().toISOString(),
  };
}

export async function inSlot<T>(action: () => Promise<T>): Promise<T> {
  if (active >= 2)
    throw new LearningError(
      "GENERATION_BUSY",
      "Two lessons are being prepared right now. Please try again in a moment.",
      429,
    );
  active++;
  try {
    return await action();
  } finally {
    active--;
  }
}
