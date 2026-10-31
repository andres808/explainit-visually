import { z } from "zod";
import type { LearningNode } from "../types";
import { difficultySchema, styleSchema } from "./schema";
import { generateIllustration } from "./ideogram";
import { inSlot } from "./service";
import {
  authorizeLiveRequest,
  json,
  learningErrorResponse,
  readJsonRequest,
} from "./http";
import { abortIfNeeded } from "./errors";

export const illustrationRequestSchema = z
  .object({
    question: z.string().trim().min(1).max(1000),
    style: styleSchema,
    difficulty: difficultySchema.default("beginner"),
    sessionId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{8,100}$/)
      .optional(),
  })
  .strict();

export async function handleIllustrationRequest(
  request: Request,
): Promise<Response> {
  try {
    const input = illustrationRequestSchema.parse(
      await readJsonRequest(request),
    );
    await authorizeLiveRequest(request, input.sessionId);
    abortIfNeeded(request.signal);
    const createdAt = new Date().toISOString();
    const draft: LearningNode = {
      id: crypto.randomUUID(),
      parentId: null,
      depth: 0,
      question: input.question,
      title: input.question,
      summary: "An image created directly from the requested subject.",
      category: "Illustration",
      difficulty: input.difficulty,
      explanation: "Image only; no AI tutoring or verified explanation.",
      objectives: [],
      components: [],
      relationships: [],
      followUps: [],
      caveats: [],
      imageUrl: "",
      hotspots: [],
      style: input.style,
      source: "ideogram",
      createdAt,
    };
    const imageUrl = await inSlot(() =>
      generateIllustration(draft, request.signal),
    );
    return json({
      id: draft.id,
      imageUrl,
      question: input.question,
      style: input.style,
      createdAt,
      source: "ideogram",
      note: "Image only; no AI tutoring or verified explanation.",
    });
  } catch (error) {
    return learningErrorResponse(error);
  }
}
