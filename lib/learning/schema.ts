import { z } from "zod";

export const difficultySchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
]);
export const styleSchema = z.enum([
  "scientific",
  "isometric",
  "blueprint",
  "textbook",
  "sketch",
  "futuristic",
]);
const short = z.string().trim().min(1).max(240);
const paragraph = z.string().trim().min(1).max(5000);
export const componentSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  name: short,
  description: z.string().min(1).max(1500),
  function: z.string().min(1).max(2000),
  visualDescription: z.string().min(1).max(1000),
  deeperQuestion: short,
  details: z.string().min(1).max(4000),
});
export const hotspotSchema = z.object({
  componentId: z.string().max(80),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});
export const lessonContentSchema = z
  .object({
    title: short,
    summary: z.string().min(1).max(800),
    category: short,
    explanation: paragraph,
    objectives: z.array(short).min(1).max(8),
    components: z.array(componentSchema).min(4).max(8),
    relationships: z
      .array(
        z.object({
          from: z.string().max(80),
          to: z.string().max(80),
          description: z.string().max(600),
        }),
      )
      .min(1)
      .max(16),
    followUps: z.array(short).length(3),
    caveats: z.array(z.string().max(600)).max(6),
  })
  .superRefine((value, ctx) => {
    const ids = new Set(value.components.map((c) => c.id));
    if (ids.size !== value.components.length)
      ctx.addIssue({
        code: "custom",
        message: "Component IDs must be unique.",
      });
    for (const relation of value.relationships)
      if (!ids.has(relation.from) || !ids.has(relation.to))
        ctx.addIssue({
          code: "custom",
          message: "Relationships must refer to valid components.",
        });
  });
export const nodeSchema = z.object({
  id: z.string().max(100),
  parentId: z.string().max(100).nullable(),
  depth: z.number().int().min(0).max(5),
  question: z.string().min(1).max(1000),
  title: short,
  summary: z.string().max(800),
  category: short,
  difficulty: difficultySchema,
  explanation: paragraph,
  objectives: z.array(short).max(8),
  components: z.array(componentSchema).min(1).max(8),
  relationships: z
    .array(
      z.object({
        from: z.string().max(80),
        to: z.string().max(80),
        description: z.string().max(600),
      }),
    )
    .max(16),
  followUps: z.array(short).max(6),
  caveats: z.array(z.string().max(600)).max(6),
  imageUrl: z.string().max(2048),
  hotspots: z.array(hotspotSchema).max(12),
  style: styleSchema,
  source: z.enum(["demo", "ideogram"]),
  createdAt: z.string().max(80),
});
export const requestSchema = z
  .object({
    mode: z.enum(["demo", "live"]).default("demo"),
    question: z.string().trim().min(1).max(1000).optional(),
    difficulty: difficultySchema.optional(),
    style: styleSchema.optional(),
    node: nodeSchema.optional(),
    componentId: z.string().max(80).optional(),
    sessionId: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{8,100}$/)
      .optional(),
    simple: z.boolean().optional(),
    edit: z.boolean().optional(),
  })
  .strict();
export type LearningRequest = z.infer<typeof requestSchema>;
export type LessonContent = z.infer<typeof lessonContentSchema>;
